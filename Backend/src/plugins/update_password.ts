import { FastifyInstance, FastifyPluginOptions } from "fastify"
import fp from 'fastify-plugin'

interface body_type{
    oldPassword:string,
    newPassword:string
}

interface userType{
    password: string;
    salt:string;
    id:string | number
}

async function update_password(fastify:FastifyInstance, opts:FastifyPluginOptions)
{
    fastify.route<{Body:body_type}>({
        method:"PUT",
        url: '/api/user/update_password',
        schema: {
            body:{
                type:"object",
                required:["oldPassword", "newPassword"],
                additionalProperties:false,
                properties:{
                    oldPassword:{
                        type:"string",
                        minLength:8,
                        maxLength:72,
                        pattern:"^[a-zA-Z0-9@#_]+$"
                    },
                    newPassword:{
                        type:"string",
                        minLength:8,
                        maxLength:72,
                        pattern:"^[a-zA-Z0-9@#_]+$"
                    }
                }
            },
            response:{
                200: {
                    type:"object",
                    properties:{
                        success: {type:'boolean'},
                        message: {type: 'string'}
                    }
                },
                '4xx':{
                    type:"object",
                    properties:{
                        success: {type: 'boolean'},
                        message: {type: 'string'}
                    }
                }
            }
        },
        handler: async function update_pass(request, reply) {
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
            const {oldPassword, newPassword} = request.body || {};
            if (!oldPassword || !newPassword)
			{
				return reply.code(400).send({
					success: false,
					message: "empty field."
				})
			}
            if (oldPassword === newPassword)
            {
                return reply.code(400).send({
                    success:false,
                    message: "The new password must be diffrent with the old password"
                })
            }
            const isMatch = await fastify.crypt_pass.verify_pass(get_user.password, oldPassword, get_user.salt);
            if (!isMatch)
            {
                return reply.code(401).send({
                    success: false,
                    message: "Incorrect password."
                })
            }
            const newSalt = await fastify.crypt_pass.getSalt();
            const hash_pass = await fastify.crypt_pass.getHash(newPassword, newSalt);
            fastify.db.prepare("UPDATE users SET password = ?, salt = ? WHERE id = ?").run(hash_pass, newSalt, get_user.id);
            return reply.code(200).send({
                success: true,
                message: "The password has been changed successfully."

            })

        }catch(error)
        {
            request.log.error(error);
            return reply.code(404).send(
                {
                    success: false,
                    message: "Internel server error: "
                }
            )
        }
        }
    })
}

export default fp(update_password, {
    name:"update_pass"
})