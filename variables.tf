variable "name" {
  description = "The name to use for the components that make up this module"
  default     = "instance_terminator"
}

variable "lambda_schedule" {
  description = "The schedule for running the Lambda"
  default     = "rate(1 day)"
}