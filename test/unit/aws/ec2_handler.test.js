'use strict';

const assert = require('chai').assert;
const expect = require('chai').expect;

const ec2_handler = require('../../../src/aws/ec2_handler');

describe('ec2_handler', function () {
    var AWS = require('aws-sdk-mock');

    afterEach(function () {
        AWS.restore();
    });

    it(`lookup oldest instance when the oldest is last in the list`, function (done) {
        const describeInstancesResponse = {
            Reservations: [{
                Instances: [{
                    InstanceId: 'i-abcd-1',
                    LaunchTime: new Date('2018-01-11T11:55:22.000Z')
                }]
            }, {
                Instances: [{
                    InstanceId: 'i-abcd-2',
                    LaunchTime: new Date('2018-01-11T09:56:50.000Z')
                }]
            }]
        }

        AWS.mock('EC2', 'describeInstances', function (params, callback) {
            expect(params['InstanceIds']).to.have.lengthOf(2);
            callback(null, describeInstancesResponse);
        });

        const lookupOldestInstanceInput = [{InstanceId: 'i-abcd-1'}, {InstanceId: 'i-abcd-2'}]
        ec2_handler.lookupOldestInstance(lookupOldestInstanceInput).then(function (result) {
            const expectedResponse = {
                InstanceId: 'i-abcd-2',
                LaunchTime: new Date('2018-01-11T09:56:50.000Z')
            }
            expect(result).to.deep.equal(expectedResponse);
            done();
        }, function(error) {
            assert.fail(error);
            done();
        });
    });

    it(`lookup oldest instance when the oldest is first in the list`, function (done) {
        const describeInstancesResponse = {
            Reservations: [{
                Instances: [{
                    InstanceId: 'i-abcd-1',
                    LaunchTime: new Date('2018-01-11T11:55:22.000Z')
                }]
            }, {
                Instances: [{
                    InstanceId: 'i-abcd-2',
                    LaunchTime: new Date('2018-01-11T12:56:50.000Z')
                }]
            }]
        }

        AWS.mock('EC2', 'describeInstances', function (params, callback) {
            expect(params['InstanceIds']).to.have.lengthOf(2);
            callback(null, describeInstancesResponse);
        });

        const lookupOldestInstanceInput = [{InstanceId: 'i-abcd-1'}, {InstanceId: 'i-abcd-2'}]
        ec2_handler.lookupOldestInstance(lookupOldestInstanceInput).then(function (result) {
            const expectedResponse = {
                InstanceId: 'i-abcd-1',
                LaunchTime: new Date('2018-01-11T11:55:22.000Z')
            }
            expect(result).to.deep.equal(expectedResponse);
            done();
        }, function(error) {
            assert.fail(error);
            done();
        });
    });
});