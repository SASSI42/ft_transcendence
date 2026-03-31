import { FastifyInstance, FastifyPluginOptions } from "fastify"
import fp from 'fastify-plugin'


interface body_type {
    Code:string,
    newPassword:string
}

interface userType{
    username: string;
    salt:string;
    id:string | number
    ResetCode:string;
    usedCode:number
    
}

async function reset_password(fastify:FastifyInstance, opts:FastifyPluginOptions)
{
    
    fastify.route<{Body:body_type}>({
        method: "PUT",
        url: '/api/user/reset-password',
        schema: {
            body:{
                type:"object",
                required:["newPassword", "Code"],
                additionalProperties:false,
                properties:{
                    newPassword:{
                        type:"string",
                        minLength:8,
                        maxLength:72,
                        pattern:"^[a-zA-Z0-9@#_]+$"
                    },
                    Code:{
                        type:"string",
                        minLength:6,
                        maxLength:6,
                        pattern:"^[0-9]{6}$"
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
        handler: async function update_mail(request, reply){
        const Token = request.cookies.token;
        if (!Token){
            return reply.code(401).send({
                success:false,
                message: 'Unauthorized'
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

            const {Code, newPassword} = request.body || {};
            if (!Code || !newPassword)
			{
				return reply.code(400).send({
					success: false,
					message: "empty field."
				})
			}
            if (get_user.usedCode === 1)
            {
                return reply.code(401).send({
                    success: false,
                    message: "The reset code is expired"
                });
            }
            const isMatch = await fastify.crypt_pass.verify_pass(get_user.ResetCode, Code, get_user.salt) as boolean;
            if (!isMatch)
            {
                return reply.code(401).send({
                    success: false,
                    message: "Incorrect reset code"
                })
            }
            const salt = await fastify.crypt_pass.getSalt() as string;
            const hash_pass = await fastify.crypt_pass.getHash(newPassword, salt) as string;
            fastify.db.prepare("UPDATE users SET password = ?, salt = ?, usedCode = ? WHERE id = ?").run(hash_pass, salt, 1, get_user.id);
            reply.clearCookie('token', {path:'/api/user/reset-password'});
            return reply.code(200).send({
                success: true,
                message: "The password has been updated successfully."
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

export default fp(reset_password, {
    name:'update_email'
})