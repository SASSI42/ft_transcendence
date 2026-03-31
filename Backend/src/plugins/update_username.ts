import { FastifyInstance, FastifyPluginOptions} from "fastify"
import fp from 'fastify-plugin'

interface body_type{
    newName:string,
    password:string
}

interface User_type{
    id:number | string,
    username:string,
    oauth2: number
}

async function update_username(fastify:FastifyInstance, opts:FastifyPluginOptions)
{
    const max_age_acc = process.env.access_token_max_age;
    const exp_acc = process.env.expire_at_acc;
    const max_age_ref = process.env.refresh_token_max_age;
    const exp_ref = process.env.expire_at_ref
    if (!max_age_acc || !max_age_ref || !exp_acc || !exp_ref)
        throw new Error("Missing cridenntials");
    const max_acc_val = Number(max_age_acc);
    const max_ref_val = Number(max_age_ref);
    if (isNaN(max_acc_val) || isNaN(max_ref_val))
        throw new Error("not a valid value");
    fastify.route<{Body:body_type}>({
        method: "PUT",
        url:'/api/user/update_username',
        schema: {
            body:{
                type:"object",
                required:["newName"],
                additionalProperties:false,
                properties:{
                    newName:{
                        type:"string",
                        minLength:4,
                        maxLength:20,
                        pattern:"^[a-zA-Z0-9]+$"
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
        handler: async function update_name(request, reply){
        const Token = request.cookies.access_token;
        if (!Token){
            return reply.code(401).send({
                success:false,
                message: 'Unauthorized: Access token missing.'
            })
        }
        try
        {
            let decoded = null
            try{
                decoded = fastify.jwt.verify(Token) as any;
            }catch(error)
            {
                return reply.code(400).send({
                    success: false,
                    message: "The token is expired"
                })
            }
            const get_user = fastify.db.prepare("SELECT * FROM users WHERE id=?").get(decoded.sub) as User_type | undefined;
            if (!get_user)
            {
                return reply.code(404).send({
                    success: false,
                    message: "User account not found."
                })
            }
            const {newName} = request.body || {};
			if (!newName)
			{
				return reply.code(400).send({
					success: false,
					message: "empty field."
				})
			}
            const nameExists = fastify.db.prepare("SELECT id FROM users WHERE username=?").get(newName)
            if (nameExists)
            {
                return reply.code(400).send({
                    success: false,
                    message: "This name is already in use."
                })
            }
            fastify.db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newName, get_user.id);
            if (get_user.oauth2 === 1)
                fastify.db.prepare('UPDATE users SET oauth_name = ? WHERE id = ?').run(1, get_user.id);
            const load = {"sub":get_user.id, "name":newName};
            const newAccessToken = fastify.jwt.sign(load, {expiresIn: String(exp_acc)});
            const newRefreshToken = fastify.jwt.sign(load, {expiresIn: String(exp_ref)});
            
            fastify.db.prepare("UPDATE users SET token = ? WHERE id = ?").run(newRefreshToken, get_user.id);

            reply.setCookie('access_token', newAccessToken, {
                path:'/',
                httpOnly: true,
                sameSite:'lax',
                maxAge: Number(max_acc_val)
            })

            reply.setCookie('refresh_token', newRefreshToken, {
                path:'/api/user/refresh',
                httpOnly: true,
                sameSite:'lax',
                maxAge: Number(max_ref_val)
            })

            return reply.code(200).send({
                success: true,
                message: "Username updates successfully."
            })
        }catch(error)
        {
            request.log.error(error);
            return reply.code(404).send({
                success:false,
                message :"Internel server error."
            })
        }
    }
    })
}

export default fp(update_username, {
    name: 'update_username'
})