import { FastifyInstance, FastifyPluginOptions} from "fastify"
import fp from 'fastify-plugin'

interface userType{
    username: string;
    salt:string;
    id:string | number
}

async function twoFactor(fastify:FastifyInstance, opts:FastifyPluginOptions)
{
    const max_age_temp = process.env.max_age_temp;
    const exp_temp = process.env.expire_temp
    if (!max_age_temp || exp_temp)
        throw new Error("Missing cridenntials");
    fastify.route({
        method:"PUT",
        url:'/api/user/two_factor',
		schema: {
            body:{
                type:"object",
                required:["email"],
                additionalProperties:false,
                properties:{
                    email:{
                        type:"string",
                        maxLength:100,
                        format:"email",
                        pattern:"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
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
        handler: async function get_new_pass(request, reply) {
            const {email} = request.body as any;
            if (!email)
            {
                return reply.code(401).send({
					success: false,
					message: "Email is required."
				}) 
            }
            try{
                const getUser = fastify.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as userType | undefined;
                if (!getUser)
                {
                    return reply.code(401).send({
                        success: false,
                        message: "Unregistred email address."
                    })
                }
                const code = await fastify.randomCode.genCode(6, 6);
                const hash_code = await fastify.crypt_pass.getHash(code, getUser.salt);
                fastify.db.prepare("UPDATE users SET twoFactorCode = ?, usedCode = ? WHERE email = ?").run(hash_code, 0, email);

				const mailOptions = {
					from: '"PONGFINITY" <no-reply@ft_transcendance.com>',
					to: email,
					subject: 'Your Two-Factor-Auth code',
					text: `Your Two-Factor-Auth code is: ${code}. This code will expire in 10 minutes. 
							Please enter this code on the Two-Factor-Auth page to continue.`,
					html: `
						<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
							<h2>Two-Factor-Auth Request</h2>
							<p>We received a two factor authentication code for your account.</p>
							<p>Your <strong>6-digit authentication code</strong> is:</p>
							<div style="font-size: 24px; font-weight: bold; 
                            background-color: #f4f4f4ff; padding: 10px; margin: 15px 0; 
                            display: inline-block; border-radius: 5px;">
								${code}
							</div>
							<p>This code is valid for <strong>10 minutes</strong>.</p>
							<p>If you did not request this, you can safely ignore this email.</p>
						</div>
                        `
				};
                    await fastify.mailer.sendMail(mailOptions)
                	const load = {"sub":getUser.id, "name":getUser.username};
					const token = fastify.jwt.sign(load, {expiresIn: String(exp_temp)});
                    
					reply.setCookie('token', token, {
						path:'/api/user/verifyCode',
						httpOnly: true,
						sameSite:'lax',
						maxAge: Number(max_age_temp)
					})
                    return reply.code(200).send({
					success: true,
					message: 'The TWO-FACTOR-AUTH code has been sent to your email.'
				});
            }catch(error)
            {
                return reply.code(404).send({
					success: false,
					message: "Failed to sent two-factor code"
				})
            }
        }
    })
}

export default fp(twoFactor, {
    name: "twoFactor"
})