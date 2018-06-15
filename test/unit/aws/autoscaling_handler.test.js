'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');

const autoscaling_handler = require('../../../src/aws/autoscaling_handler');

describe('autoscaling_handler', function () {
    var AWS = require('aws-sdk-mock');

    afterEach(function () {
        AWS.restore();
    });

    it(`findAutoscalingGroupsByTag_whenTagNamesDoNotMatch`, function (done) {
        AWS.mock('AutoScaling', 'describeAutoScalingGroups', function (params, callback) {
            callback(null, describeAutoscalingGroupsResponse_whenTagNamesDoNotMatch);
        });

        autoscaling_handler.findAutoscalingGroupsByTag("some-tag", "some-value").then(function (result) {
            expect(result).to.have.lengthOf(0);
            done();
        }, function(error) {
            assert.fail(error);
            done();
        });
    });

    it(`findAutoscalingGroupsByTag_whenTagValuesDoNoMatch`, function (done) {
        AWS.mock('AutoScaling', 'describeAutoScalingGroups', function (params, callback) {
            callback(null, describeAutoscalingGroupsResponse_whenTagValuesDoNoMatch);
        });

        autoscaling_handler.findAutoscalingGroupsByTag("some-tag", "some-value").then(function (result) {
            expect(result).to.have.lengthOf(0);
            done();
        }, function(error) {
            assert.fail(error);
            done();
        });
    });

    it(`findAutoscalingGroupsByTag_whenTagValuesMatch`, function (done) {
        AWS.mock('AutoScaling', 'describeAutoScalingGroups', function (params, callback) {
            callback(null, describeAutoscalingGroupsResponse_whenTagValuesMatch);
        });

        autoscaling_handler.findAutoscalingGroupsByTag("some-tag", "some-value").then(function (result) {
            expect(result).to.have.lengthOf(2);
            done();
        }, function(error) {
            assert.fail(error);
            done();
        });
    });

    it( `terminate_instance`, function() {
        var terminateInstance = sinon.spy();
        AWS.mock('AutoScaling', 'terminateInstanceInAutoScalingGroup', terminateInstance);

        autoscaling_handler.terminateInstance("i-123456");

        var expectedParams = {
            InstanceId: 'i-123456',
            ShouldDecrementDesiredCapacity: false
        };
        expect(terminateInstance.calledOnce, 'terminate instance called once').to.be.true;
        expect(terminateInstance.calledWith(expectedParams), 'terminate instance parameters').to.be.true;
    });
});

const describeAutoscalingGroupsResponse_whenTagNamesDoNotMatch = {
    ResponseMetadata: {
        RequestId: 'd3f3e7ea-f6b5-11e7-b320-07888c59bfce'
    },
    AutoScalingGroups: [
        {
            AutoScalingGroupName: 'my-asg-no-matching',
            Tags: [
                {
                    Key: 'Name',
                    Value: 'my-asg-no-matching',
                }
            ]
        },
        {
            AutoScalingGroupName: 'another-asg-no-matching',
            Tags: [
                {
                    Key: 'Name',
                    Value: 'another-asg-no-matching',
                }
            ]
        }
    ]
}

const describeAutoscalingGroupsResponse_whenTagValuesDoNoMatch = {
    ResponseMetadata: {
        RequestId: 'd3f3e7ea-f6b5-11e7-b320-07888c59bfce'
    },
    AutoScalingGroups: [
        {
            AutoScalingGroupName: 'my-asg-no-matching',
            Tags: [
                {
                    Key: 'Name',
                    Value: 'my-asg-no-matching',
                }
            ]
        },
        {
            AutoScalingGroupName: 'another-asg-no-matching',
            Tags: [
                {
                    Key: 'Name',
                    Value: 'another-asg-no-matching',
                },
                {
                    Key: 'some-tag',
                    Value: 'another-value',
                }
            ]
        }
    ]
}

const describeAutoscalingGroupsResponse_whenTagValuesMatch = {
    ResponseMetadata: {
        RequestId: 'd3f3e7ea-f6b5-11e7-b320-07888c59bfce'
    },
    AutoScalingGroups: [
        {
            AutoScalingGroupName: 'my-asg-matching',
            Tags: [
                {
                    Key: 'some-tag',
                    Value: 'some-value',
                }
            ]
        },
        {
            AutoScalingGroupName: 'another-asg-matching',
            Tags: [
                {
                    Key: 'some-tag',
                    Value: 'some-value',
                }
            ]
        }
    ]
}