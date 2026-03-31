import {FastifyInstance, FastifyPluginOptions} from "fastify"
import fp from 'fastify-plugin'

async function login(fastify:FastifyInstance, opts:FastifyPluginOptions)
{
    fastify.route({
        method: "GET",
        url: '/api/user/login',
        handler: async function update_mail(request, reply){
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
            const get_user = fastify.db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.sub) as any;
            if (!get_user)
            {
                return reply.code(400).send({
                    success: false,
                    message: "User account not found."
                })
            }
            return reply.code(200).send({
                succes: true,
                message: "successfully connected",
                user: {
                    id: get_user.id,
                    username: get_user.username,
                    avatar: get_user.Avatar,
                    email: get_user.email
                }
            })

        }catch(error)
        {
            request.log.error(error);
            return reply.code(404).send(
                {
                    login: false,
                    success: false,
                    message: "Internel server error: "
                }
            )
        }
        }
    })
}

export default fp(login, {
    name:'login'
})