provider "archive" {
  version = "1.0"
}

resource "aws_iam_policy" "instance_terminator_lambda" {
  name        = "instance-terminator-lambda"
  path        = "/"
  description = "instance-terminator-lambda"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "autoscaling:Describe*",
      "ec2:Describe*"
    ],
    "Resource": "*"
  }, {
    "Effect": "Allow",
    "Action": [
      "autoscaling:TerminateInstanceInAutoScalingGroup"
    ],
    "Resource": "*",
    "Condition": {
        "StringEquals": { "autoscaling:ResourceTag/can-be-terminated": "true" }
     }
  }, {
    "Effect": "Allow",
    "Action": [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ],
    "Resource": "*"
  }, {
    "Effect": "Allow",
    "Action": [
      "route53:*"
    ],
    "Resource": [
      "*"
    ]
  }]
}
EOF
}

resource "aws_iam_role" "instance_terminator_lambda" {
  name = "instance-terminator-lambda"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "instance_terminator_lambda" {
    role       = "${aws_iam_role.instance_terminator_lambda.name}"
    policy_arn = "${aws_iam_policy.instance_terminator_lambda.arn}"
}

data "archive_file" "instance_terminator" {
  type        = "zip"
  source_file = "${path.module}/lambda/src/instance_terminator.js"
  output_path = "${path.module}/lambda/instance_terminator.zip"
}

resource "aws_lambda_function" "instance_terminator" {
  filename         = "${data.archive_file.instance_terminator.output_path}"
  function_name    = "instance_terminator"
  role             = "${aws_iam_role.instance_terminator_lambda.arn}"
  handler          = "instance_terminator.handler"
  timeout          = 30
  source_code_hash = "${base64sha256(file("${data.archive_file.instance_terminator.output_path}"))}"
  runtime          = "nodejs6.10"
}

resource "aws_cloudwatch_event_rule" "lambda_instance_terminator" {
  name                = "lambda_instance_terminator"
  description         = "lambda_instance_terminator"
  schedule_expression = "${var.lambda_schedule}"
}

resource "aws_cloudwatch_event_target" "lambda_instance_terminator" {
  rule      = "${aws_cloudwatch_event_rule.lambda_instance_terminator.name}"
  arn       = "${aws_lambda_function.instance_terminator.arn}"
}

resource "aws_lambda_permission" "lambda_instance_terminator" {
  statement_id   = "45"
  action         = "lambda:InvokeFunction"
  function_name  = "${aws_lambda_function.instance_terminator.function_name}"
  principal      = "events.amazonaws.com"
  source_arn     = "${aws_cloudwatch_event_rule.lambda_instance_terminator.arn}"
}
