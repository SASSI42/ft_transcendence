import { FastifyInstance, FastifyPluginOptions} from "fastify"
import fp from 'fastify-plugin'

type body_type = {
    password:string,
    newAddress:string
}

interface userType{
    password : string;
    salt: string;
    id: string | number
}

async function update_email(fastify:FastifyInstance, opts:FastifyPluginOptions)
{
    fastify.route<{Body:body_type}>({
        method: "PUT",
        url: '/api/user/update_email',
        schema: {
            body:{
                type:"object",
                required:["password", "newAddress"],
                additionalProperties:false,
                properties:{
                    password:{
                        type:"string",
                        minLength:8,
                        maxLength:72,
                        pattern:"^[a-zA-Z0-9@#_]+$"
                    },
                    newAddress:{
                        type:"string",
                        maxLength:100,
                        format:"email",
                        pattern:"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
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
            const {newAddress, password} = request.body || {};
            if (!newAddress || !password)
			{
				return reply.code(400).send({
					success: false,
					message: "empty field."
				})
			}
            const isMatch = await fastify.crypt_pass.verify_pass(get_user.password, password, get_user.salt);
            if (!isMatch)
            {
                return reply.code(401).send({
                    success: false,
                    message: "Incorrect password."
                })
            }
            const existEmail = fastify.db.prepare("SELECT * FROM users WHERE email = ?").get(newAddress);
            if (existEmail)
            {
                return reply.code(400).send({
                    success:false,
                    message: "The address already in use"
                })
            }
            fastify.db.prepare("UPDATE users SET email = ? WHERE id = ?").run(newAddress, get_user.id);
            return reply.code(200).send({
                success: true,
                message: "The email adddress has been changed successfully."

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

export default fp(update_email, {
    name:'update_email'
})