import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'

const myPlugin:FastifyPluginAsync = async (fastify, opts) => {
    fastify.addSchema(require('../../schemas/create-body.json'));
    fastify.addSchema(require('../../schemas/create-response.json'));
    fastify.addSchema(require('../../schemas/create-response_signUp'));
    fastify.addSchema(require('../../schemas/create-signin-body.json'));
};

export default fp(myPlugin);