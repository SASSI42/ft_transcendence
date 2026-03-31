import { FastifyInstance, FastifyPluginOptions} from "fastify"
import fp from 'fastify-plugin'

interface userType{
    oauth2: number
    twoFA: number;
}

async function tfa_activator(fastify:FastifyInstance, opts:FastifyPluginOptions) {
    fastify.route({
        method: "put",
        url: '/api/user/tfa_activator',
        handler: async function handler(request, reply){
            const Token = request.cookies.access_token;
            if (!Token){
                return reply.code(401).send({
                    success:false,
                    message: 'Unauthorized: Access token missing.'
                })
            }
            try{
                let decoded = null
                try{
                    decoded = await fastify.jwt.verify(Token) as any;
                }catch(error)
                {
                    request.log.error(error);
                    return reply.code(400).send({
                        success: false,
                        message: "The token is expired"
                    })
                }
                const get_user = fastify.db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.sub) as userType | undefined;
                if (!get_user)
                {
                    return reply.code(400).send({
                        success: false,
                        message: "User account not found."
                    })
                }
                if (get_user.twoFA === 0 && get_user.oauth2 === 0)
                {
                    fastify.db.prepare("UPDATE users SET twoFA = ? WHERE id=?").run(1, decoded.sub);
                    return reply.code(200).send({
                    success: true,
                    message: "twoFA is enabled"})

                }
                else if (get_user.twoFA === 1 && get_user.oauth2 === 0)
                {
                    fastify.db.prepare("UPDATE users SET twoFA = ? WHERE id=?").run(0, decoded.sub);
                    return reply.code(200).send({
                        success: true,
                        message: "twoFA is disabled"})
                }
                else{
                    return reply.code(400).send({
                        success: false,
                        message: "The two factor auth  is not allowed"
                    }) 
                }
            }catch(error)
            {
                return reply.code(404).send({
                    success: false,
                    message: "Internel server error"})
            }
        }
    })
    
}

export default  fp(tfa_activator)