import Fastify,{ FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply, FastifyPluginAsync, fastify } from "fastify"
import fp from 'fastify-plugin'
import crypto from 'node:crypto'

async function codeGenerator(fastify:FastifyInstance, opts: FastifyPluginOptions)
{
   async  function genCode(minLength:number, maxLength:number)
    {
        const numbers = '0123456789';
        const allChars = numbers;

        const lengthRange = maxLength - minLength + 1;
        const randomLength = minLength + crypto.randomInt(lengthRange);

        let passwordChars = [
            numbers[crypto.randomInt(numbers.length)],
        ];

        const remainingLength = randomLength - passwordChars.length;
        const randomBytes = crypto.randomBytes(remainingLength);

        for (let i = 0; i < remainingLength; i++) {
            const index = randomBytes[i] % allChars.length;
            passwordChars.push(allChars[index]);
        }

        for (let i = passwordChars.length - 1; i > 0; i--) {
            const j = crypto.randomInt(i + 1);
            [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
        }

        return passwordChars.join('');
    }
    fastify.decorate('randomCode', {genCode}); 
}

export default fp(codeGenerator, {
    name: 'passGen'
})