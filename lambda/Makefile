NODE_ENV ?= development
DOCKER_COMPOSE ?= docker-compose
DOCKER_RUN ?= ${DOCKER_COMPOSE} run --rm
NPM ?= ${DOCKER_RUN} -e NODE_ENV=${NODE_ENV} node npm

all: clean-up install unit-test

install:
	${NPM} install
.PHONY: install

unit-test:
	${DOCKER_RUN} unit-test
.PHONY: unit-test

clean-up:
	rm -rf node_modules instance_terminator.zip
.PHONY: clean-up