'use strict';

var expect = require( 'chai' ).expect;
var sinon = require( 'sinon' );

var LambdaTester = require( 'lambda-tester' );

var myLambda = require( '../src/instance_terminator' );

describe( 'instance-terminator', function() {

    var AWS = require('aws-sdk-mock');

    afterEach(function() {
        AWS.restore();
    });

    it( `no matching autoscaling groups`, function() {
        AWS.mock('AutoScaling', 'describeAutoScalingGroups', function (params, callback){
            callback(null, describeAutoscalingGroupsResponse_no_matching);
        });
        var describeInstances = sinon.spy();
        AWS.mock('EC2', 'describeInstances', describeInstances);
        var terminateInstance = sinon.spy();
        AWS.mock('AutoScaling', 'terminateInstanceInAutoScalingGroup', terminateInstance);

        return LambdaTester( myLambda.handler )
            .event()
            .expectResult( ( result ) => {
                expect( result.success ).to.be.true;
                expect( describeInstances.notCalled, 'describe instances should not be called' ).to.be.true;
                expect( terminateInstance.notCalled, 'terminate instance should not be called' ).to.be.true;
            });
    });

    it( `too few instances in autoscaling groups`, function() {
        AWS.mock('AutoScaling', 'describeAutoScalingGroups', function (params, callback){
            callback(null, describeAutoscalingGroupsResponse_1_instance);
        });
        var describeInstances = sinon.spy();
        AWS.mock('EC2', 'describeInstances', describeInstances);
        var terminateInstance = sinon.spy();
        AWS.mock('AutoScaling', 'terminateInstanceInAutoScalingGroup', terminateInstance);

        return LambdaTester( myLambda.handler )
            .event()
            .expectResult( ( result ) => {
                expect( result.success ).to.be.true;
                expect( describeInstances.notCalled, 'describe instances should not be called' ).to.be.true;
                expect( terminateInstance.notCalled, 'terminate instance should not be called' ).to.be.true;
        });
    });

    it( `unhealthy instances in autoscaling groups`, function() {
        AWS.mock('AutoScaling', 'describeAutoScalingGroups', function (params, callback){
            callback(null, describeAutoscalingGroupsResponse_unhealthy_instance);
        });
        var describeInstances = sinon.spy();
        AWS.mock('EC2', 'describeInstances', describeInstances);
        var terminateInstance = sinon.spy();
        AWS.mock('AutoScaling', 'terminateInstanceInAutoScalingGroup', terminateInstance);

        return LambdaTester( myLambda.handler )
            .event()
            .expectResult( ( result ) => {
                expect( result.success ).to.be.true;
                expect( describeInstances.notCalled, 'describe instances should not be called' ).to.be.true;
                expect( terminateInstance.notCalled, 'terminate instance should not be called' ).to.be.true;
        });
    });

    it( `successful invocation`, function() {

        AWS.mock('AutoScaling', 'describeAutoScalingGroups', function (params, callback){
            callback(null, describeAutoscalingGroupsResponse);
        });
        AWS.mock('EC2', 'describeInstances', function (params, callback){
            callback(null, describeInstances);
        });
        var terminateInstance = sinon.spy();
        AWS.mock('AutoScaling', 'terminateInstanceInAutoScalingGroup', terminateInstance);

        return LambdaTester( myLambda.handler )
            .event()
            .expectResult( ( result ) => {
                expect( result.success ).to.be.true;
                expect( terminateInstance.calledOnce, 'terminate instance called once' ).to.be.true;

                var expectedParams = {
                    InstanceId: 'i-087792a26bd5f156b',
                    ShouldDecrementDesiredCapacity: false
                };
                expect( terminateInstance.calledWith(expectedParams), 'terminate instance parameters' ).to.be.true;
            });
    });
});

var describeAutoscalingGroupsResponse_no_matching = {
    ResponseMetadata: {
        RequestId: 'd3f3e7ea-f6b5-11e7-b320-07888c59bfce'
    },
    AutoScalingGroups: [
        {
            AutoScalingGroupName: 'my-asg-no-matching',
            MinSize: 2,
            MaxSize: 2,
            DesiredCapacity: 2,
            Tags: [{
                ResourceId: 'my-asg-no-matching',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'my-asg-no-matching',
                PropagateAtLaunch: true
                }]
        },
        {
            AutoScalingGroupName: 'another-asg-no-matching',
            MinSize: 0,
            MaxSize: 0,
            DesiredCapacity: 0,
            Tags: [{
                ResourceId: 'another-asg-no-matching',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'another-asg-no-matching',
                PropagateAtLaunch: true
                }]
        }
    ]
}

var describeAutoscalingGroupsResponse_1_instance = {
    ResponseMetadata: {
        RequestId: 'd3f3e7ea-f6b5-11e7-b320-07888c59bfce'
    },
    AutoScalingGroups: [
        {
            AutoScalingGroupName: 'my-asg-1-instance',
            MinSize: 1,
            MaxSize: 1,
            DesiredCapacity: 1,
            Tags: [{
                ResourceId: 'my-asg-1-instance',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'my-asg-1-instance',
                PropagateAtLaunch: true
            }, {
                ResourceId: 'my-asg-1-instance',
                ResourceType: 'auto-scaling-group',
                Key: 'can-be-terminated',
                Value: 'true',
                PropagateAtLaunch: true
            }]
        },
        {
            AutoScalingGroupName: 'another-asg-1-instance',
            MinSize: 0,
            MaxSize: 0,
            DesiredCapacity: 0,
            Tags: [{
                ResourceId: 'another-asg-1-instance',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'another-asg-1-instance',
                PropagateAtLaunch: true
            }]
        }
    ]
}

var describeAutoscalingGroupsResponse_unhealthy_instance = {
    ResponseMetadata: {
        RequestId: 'd3f3e7ea-f6b5-11e7-b320-07888c59bfce'
    },
    AutoScalingGroups: [
        {
            AutoScalingGroupName: 'my-asg-unhealthy-instance',
            MinSize: 2,
            MaxSize: 2,
            DesiredCapacity: 2,
            Instances:  [{
                InstanceId: 'i-03a2a8ad7e70a48b3',
                AvailabilityZone: 'eu-west-1c',
                LifecycleState: 'Pending',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'my-asg-unhealthy-instance-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }, {
                InstanceId: 'i-087792a26bd5f156b',
                AvailabilityZone: 'eu-west-1b',
                LifecycleState: 'InService',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'my-asg-unhealthy-instance-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }],
            Tags: [{
                ResourceId: 'my-asg-unhealthy-instance',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'my-asg-unhealthy-instance',
                PropagateAtLaunch: true
            }, {
                ResourceId: 'my-asg-unhealthy-instance',
                ResourceType: 'auto-scaling-group',
                Key: 'can-be-terminated',
                Value: 'true',
                PropagateAtLaunch: true
            }]
        },
        {
            AutoScalingGroupName: 'another-asg-unhealthy-instance',
            MinSize: 0,
            MaxSize: 0,
            DesiredCapacity: 0,
            Tags: [{
                ResourceId: 'another-asg-unhealthy-instance',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'another-asg-unhealthy-instance',
                PropagateAtLaunch: true
            }]
        }
    ]
}

var describeAutoscalingGroupsResponse = {
    ResponseMetadata: {
        RequestId: 'd3f3e7ea-f6b5-11e7-b320-07888c59bfce'
    },
    AutoScalingGroups: [
        {
            AutoScalingGroupName: 'my-asg',
            MinSize: 2,
            MaxSize: 2,
            DesiredCapacity: 2,
            Instances:  [{
                InstanceId: 'i-03a2a8ad7e70a48b3',
                AvailabilityZone: 'eu-west-1c',
                LifecycleState: 'InService',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'my-asg-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }, {
                InstanceId: 'i-087792a26bd5f156b',
                AvailabilityZone: 'eu-west-1b',
                LifecycleState: 'InService',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'my-asg-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }],
            Tags: [{
                ResourceId: 'my-asg',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'my-asg',
                PropagateAtLaunch: true
            }, {
                ResourceId: 'my-asg',
                ResourceType: 'auto-scaling-group',
                Key: 'can-be-terminated',
                Value: 'true',
                PropagateAtLaunch: true
            }]
        },
        {
            AutoScalingGroupName: 'another-asg',
            MinSize: 0,
            MaxSize: 0,
            DesiredCapacity: 0,
            Tags: [{
                ResourceId: 'another-asg',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'another-asg',
                PropagateAtLaunch: true
            }]
        }
    ]
}

var describeInstances = {
    Reservations: [{
        Groups: [],
        Instances: [{
            InstanceId: 'i-03a2a8ad7e70a48b3',
            LaunchTime: new Date('2018-01-11T11:55:22.000Z'),
            PrivateDnsName: 'ip-10-100-130-46.eu-west-1.compute.internal',
            PrivateIpAddress: '10.100.130.46',
            State: {
                Code: 16,
                Name: 'running'
            }
        }],
        OwnerId: '123456789012',
        RequesterId: '123456789012',
        ReservationId: 'r-0aff744b37d85b3dc'
    }, {
        Groups: [],
        Instances: [{
            InstanceId: 'i-087792a26bd5f156b',
            LaunchTime: new Date('2018-01-11T09:56:50.000Z'),
            PrivateDnsName: 'ip-10-100-129-65.eu-west-1.compute.internal',
            PrivateIpAddress: '10.100.129.65',
            State: {
                Code: 16,
                Name: 'running'
            },
        }],
        OwnerId: '123456789012',
        RequesterId: '123456789012',
        ReservationId: 'r-021e47583509a7a3e'
    }]
}