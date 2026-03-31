import Fastify,{ FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply, FastifyPluginAsync, fastify } from "fastify"
import fp, { fastifyPlugin } from 'fastify-plugin'
import crypto from 'node:crypto'

async function encryption(fastify:FastifyInstance, opts:FastifyPluginOptions){

    async function getSalt()
    {
        return crypto.randomBytes(16).toString('hex');
    }

    async function getHash(password: string, salt:string)
    {
        return (crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex'));
    }

    async function verify_pass(hashPassword:String, password:string, salt:string)
    {
        const newHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
        return(newHash === hashPassword)
    }

    fastify.decorate("crypt_pass", {
        getSalt,
        getHash,
        verify_pass
    });
}

export default fp(encryption, {
    name: 'crypt'
})