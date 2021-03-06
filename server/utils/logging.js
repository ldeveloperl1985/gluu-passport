const
	fs = require('fs'),
	winston = require('winston'),
	dailyRotateFile = require('winston-daily-rotate-file'),
	Stomp = require('stomp-client'),
	util = require('util'),
	R = require('ramda'),
	misc = require('./misc'),
	format = winston.format

const
	dir = R.defaultTo(__dirname + '/logs', process.env.NODE_LOGGING_DIR),
	defaultLogOptions = {
		filename: dir + '/passport-%DATE%.log',
		handleExceptions: true,
		datePattern: 'YYYY-MM-DD',
		maxSize: '20m',
	},
	flogOpts = {
		filename: dir + '/passport.log',
		maxSize: defaultLogOptions.maxSize,
		maxFiles: 5,
		options: { flags : 'w' }
	},
	logger = winston.createLogger({
		exitOnError: false,
		format: format.combine(
			format.splat(),
			format.padLevels(),
			format.timestamp(),
			format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`)
		)
	})

logger.stream = {
	write: (message) => log2('info', message.trim())
}

var transport, fileTransport, consoleTransport
var MQDetails, stompClient
var prevConfigHash = 0

if (!fs.existsSync(dir)){
	fs.mkdirSync(dir)
}

function addFileTransport(level) {
	fileTransport = new winston.transports.File(R.assoc('level', level, flogOpts))
	logger.add(fileTransport, {}, true)
}

function configure(cfg) {

	let h = misc.hash(cfg)
	//Only makes recomputations if config data changed
	if (h != prevConfigHash) {

		prevConfigHash = h
		let level = R.defaultTo('info', cfg.level)

		//Remove console log + rotary file transports
		R.forEach(l => logger.remove(l), R.filter(R.complement(R.isNil), [transport, consoleTransport]))

		if (R.propEq('consoleLogOnly', true, cfg)) {
			consoleTransport = new winston.transports.Console({ level: level })
			logger.add(consoleTransport, {}, true)

			if (fileTransport) {
				logger.remove(fileTransport)
				fileTransport = undefined
			}
		} else {

			if (fileTransport) {
				fileTransport.level = level
			} else {
				addFileTransport(level)
			}

			transport = new dailyRotateFile(R.assoc('level', level, defaultLogOptions))
			// eslint-disable-next-line no-unused-vars
			transport.on('rotate', function(oldFilename, newFilename) {
				//remove method flushes passport.log file
				logger.remove(fileTransport)
				addFileTransport(level)
			})
			logger.add(transport, {}, true)
		}

		if (R.pathEq(['activeMQConf', 'enabled'], true, cfg)) {
			let mqSetUp = cfg.activeMQConf
			MQDetails = {
				CLIENT_QUEUE_NAME: 'oauth2.audit.logging',
				host: mqSetUp.host,
				port: mqSetUp.port,
				user: mqSetUp.username,
				password: mqSetUp.password,
				protocolVersion: '1.1',
				reconnectOpts: {
					retries: 10,
					delay: 5000
				}
			}
			stompClient = new Stomp(MQDetails)
			stompClient.connect(

				// eslint-disable-next-line no-unused-vars
				sessionId => logger.info('Connected to STOMP server')
				//, The error callback is called successively until the connection succeeds...
				//e => logger.error(`Error connecting to STOMP server: ${e.message}`)
			)

		} else {
			MQDetails = undefined
			if (stompClient) {
				stompClient.disconnect(() => {
					logger.info('Disconnected from STOMP server')
				})
			}
		}

		log2('info', 'Loggers reconfigured')
	}

}

function sendMQMessage(msg) {
	if (MQDetails){
		stompClient.publish('/' + MQDetails.CLIENT_QUEUE_NAME, msg)
	}
}

function log2(level, msg) {

	//npm log levels (https://github.com/winstonjs/winston#logging-levels)
	let levels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
	level = level.toLowerCase()
	level = R.includes(level, levels) ? level : 'info'

	msg = R.defaultTo('', msg)

	//Convert arguments to a real array (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments#Description)
	var args = [].slice.call(arguments)
	args[0] = level
	args[1] = msg

	//Log it to winston logger
	logger.log.apply(logger, args)

	//Log it to MQ
	args[1] = level + ': ' + args[1]
	args.shift()

	sendMQMessage(R.apply(util.format, args))

}

module.exports = {
	logger: logger,
	configure: configure,
	log2: log2,
	sendMQMessage: sendMQMessage
}
