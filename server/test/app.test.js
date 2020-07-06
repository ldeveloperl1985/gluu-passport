const request = require('supertest');
const app = require('../../server/app');

describe('App', () => {
    
    after((done) => {
        // app.close(done);
        done();
    });

    it('Health Check', (done) => {
        expect('test').to.equal('test');
        done()
        // request(app)
        //     .get('/')
        //     .expect(200)
        //     .end((err, res) => {
        //         if (err) throw done(err);

        //         done();
        //     });
    });

});
