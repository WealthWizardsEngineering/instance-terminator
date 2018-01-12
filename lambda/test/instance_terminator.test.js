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
                expect( result.terminated_instances).to.have.lengthOf( 0 );
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
                expect( result.terminated_instances).to.have.lengthOf( 1 );
                expect( result.terminated_instances[0] ).to.equal( 'none' );
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
                expect( result.terminated_instances).to.have.lengthOf( 1 );
                expect( result.terminated_instances[0] ).to.equal( 'none' );
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
                expect( result.terminated_instances).to.have.lengthOf( 1 );
                expect( result.terminated_instances[0] ).to.equal( 'i-instance-2' );
                expect( terminateInstance.calledOnce, 'terminate instance called once' ).to.be.true;

                var expectedParams = {
                    InstanceId: 'i-instance-2',
                    ShouldDecrementDesiredCapacity: false
                };
                expect( terminateInstance.calledWith(expectedParams), 'terminate instance parameters' ).to.be.true;
            });
    });

    it( `successful invocation_with_multiple_asgs`, function() {

        AWS.mock('AutoScaling', 'describeAutoScalingGroups', function (params, callback){
            callback(null, describeAutoscalingGroupsResponse_multiple_asgs);
        });
        AWS.mock('EC2', 'describeInstances', function (params, callback){
            if (params['InstanceIds'].indexOf('i-multiple-asgs-1') > -1) {
                callback(null, describeInstances_with_multiple_asgs_1);
            } else {
                callback(null, describeInstances_with_multiple_asgs_2);
            }
        });
        var terminateInstance = sinon.spy();
        AWS.mock('AutoScaling', 'terminateInstanceInAutoScalingGroup', terminateInstance);

        return LambdaTester( myLambda.handler )
            .event()
            .expectResult( ( result ) => {
                expect( result.terminated_instances).to.have.lengthOf( 2 );
                expect( result.terminated_instances).to.have.members(['i-multiple-asgs-2', 'i-multiple-asgs-4']);
                expect( terminateInstance.callCount, 'terminate instance called twice' ).to.equal(2);

                var expectedParams1 = {
                    InstanceId: 'i-multiple-asgs-2',
                    ShouldDecrementDesiredCapacity: false
                };
                expect( terminateInstance.calledWith(expectedParams1), 'terminate instance parameters' ).to.be.true;
                var expectedParams2 = {
                    InstanceId: 'i-multiple-asgs-4',
                    ShouldDecrementDesiredCapacity: false
                };
                expect( terminateInstance.calledWith(expectedParams2), 'terminate instance parameters' ).to.be.true;
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
                InstanceId: 'i-unhealth-instance-1',
                AvailabilityZone: 'eu-west-1c',
                LifecycleState: 'Pending',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'my-asg-unhealthy-instance-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }, {
                InstanceId: 'i-unhealth-instance-2',
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
                InstanceId: 'i-instance-1',
                AvailabilityZone: 'eu-west-1c',
                LifecycleState: 'InService',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'my-asg-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }, {
                InstanceId: 'i-instance-2',
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

var describeAutoscalingGroupsResponse_multiple_asgs = {
    ResponseMetadata: {
        RequestId: 'd3f3e7ea-f6b5-11e7-b320-07888c59bfce'
    },
    AutoScalingGroups: [
        {
            AutoScalingGroupName: 'my-asg-multiple-asgs',
            MinSize: 2,
            MaxSize: 2,
            DesiredCapacity: 2,
            Instances:  [{
                InstanceId: 'i-multiple-asgs-1',
                AvailabilityZone: 'eu-west-1c',
                LifecycleState: 'InService',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'my-asg-multiple-asgs-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }, {
                InstanceId: 'i-multiple-asgs-2',
                AvailabilityZone: 'eu-west-1b',
                LifecycleState: 'InService',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'my-asg-multiple-asgs-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }],
            Tags: [{
                ResourceId: 'my-asg-multiple-asgs',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'my-asg-multiple-asgs',
                PropagateAtLaunch: true
            }, {
                ResourceId: 'my-asg-multiple-asgs',
                ResourceType: 'auto-scaling-group',
                Key: 'can-be-terminated',
                Value: 'true',
                PropagateAtLaunch: true
            }]
        },
        {
            AutoScalingGroupName: 'another-asg-multiple-asgs',
            MinSize: 2,
            MaxSize: 2,
            DesiredCapacity: 2,
            Instances:  [{
                InstanceId: 'i-multiple-asgs-3',
                AvailabilityZone: 'eu-west-1c',
                LifecycleState: 'InService',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'another-asg-multiple-asgs-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }, {
                InstanceId: 'i-multiple-asgs-4',
                AvailabilityZone: 'eu-west-1b',
                LifecycleState: 'InService',
                HealthStatus: 'Healthy',
                LaunchConfigurationName: 'another-asg-multiple-asgs-20180108195930693600000001',
                ProtectedFromScaleIn: false
            }],
            Tags: [{
                ResourceId: 'another-asg-multiple-asgs',
                ResourceType: 'auto-scaling-group',
                Key: 'Name',
                Value: 'another-asg-multiple-asgs',
                PropagateAtLaunch: true
            }, {
                ResourceId: 'another-asg-multiple-asgs',
                ResourceType: 'auto-scaling-group',
                Key: 'can-be-terminated',
                Value: 'true',
                PropagateAtLaunch: true
            }]
        }
    ]
}

var describeInstances = {
    Reservations: [{
        Groups: [],
        Instances: [{
            InstanceId: 'i-instance-1',
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
            InstanceId: 'i-instance-2',
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

var describeInstances_with_multiple_asgs_1 = {
    Reservations: [{
        Groups: [],
        Instances: [{
            InstanceId: 'i-multiple-asgs-1',
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
            InstanceId: 'i-multiple-asgs-2',
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

var describeInstances_with_multiple_asgs_2 = {
    Reservations: [{
        Groups: [],
        Instances: [{
            InstanceId: 'i-multiple-asgs-3',
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
            InstanceId: 'i-multiple-asgs-4',
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