import { FastifyInstance, FastifyPluginOptions} from "fastify"
import fp from 'fastify-plugin'

type body_type = {
    code:string,
}

interface userType{
    username: string;
    email: string;
    id: string | number
    twoFactorCode: string;
    salt: string;
    usedCode: string
}

async function twoFactorHandler(fastify:FastifyInstance, opts:FastifyPluginOptions)
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
        method:"PUT",
        url: '/api/user/verifyCode',
        schema: {
            body:{
                type:"object",
                required:["code"],
                additionalProperties:false,
                properties:{
                    code:{
                        type:"string",
                        minLength:6,
                        maxLength:6,
                        pattern:"^[0-9]{6}$"
                    },
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
        handler: async function verify_code(request, reply) {
            const Token = request.cookies.token;
            if (!Token)
            {
                return reply.code(401).send({
                    success: false,
                    message: "Unauthorized"
                })
            }
            try{
                let decoded = null;
                try{
                    decoded = await fastify.jwt.verify(Token);
                }
                catch(err)
                {
                    return reply.code(400).send({
                        success: false,
                        message: "The code is expired signin again"
                    })
                }
                const {code} = request.body || {};
                if (!code)
                {
                    return reply.code(400).send({
                        success: false,
                        message: "the field is empty"
                    })
                }
                const getUser = fastify.db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.sub) as userType | undefined;
                if (!getUser)
                {
                    return reply.code(404).send({
                        success:false,
                        message: "Token is expired sign in again"
                    })
                }
                const isMatches = await fastify.crypt_pass.verify_pass(getUser.twoFactorCode, code, getUser.salt);
                if (!isMatches)
                {
                    return reply.code(404).send({
                        success: false,
                        message: "Incorrect auth code."
                    })
                }
                if (getUser.usedCode)
                {
                    return reply.code(401).send({
                        success:false,
                        message: "The code is expired signin again"
                    })

                }
                const load = {"sub":getUser.id, "name":getUser.username};
                const accessToken = fastify.jwt.sign(load, {expiresIn: String(exp_acc)});
                const refreshToken = fastify.jwt.sign(load, {expiresIn: String(exp_ref)});
				fastify.db.prepare("UPDATE users SET token = ?, usedCode = ? WHERE email = ?").run(refreshToken, 1, getUser.email);

                reply.setCookie('access_token', accessToken, {
                    path:'/',
                    httpOnly: true,
                    sameSite:'lax',
                    maxAge: Number(max_acc_val)
                })
                
                reply.setCookie('refresh_token', refreshToken, {
                    path:'/api/user/refresh',
                    httpOnly: true,
                    sameSite:'lax',
                    maxAge: Number(max_ref_val)
                })
                return reply.code(200).send({
                    "success": true,
                    "message": "signed succesfuly"

                })
            }catch(error)
            {
                return reply.code(404).send(
                    {
                        success: false,
                        message: "Internel server error: " + error
                    }
                )
            }
        }
    })
}

export default fp(twoFactorHandler, {
    name:"verify_code"
})