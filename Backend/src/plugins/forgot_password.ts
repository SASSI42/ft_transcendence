import { FastifyInstance, FastifyPluginOptions } from "fastify"
import fp from 'fastify-plugin'

interface body_type{
    email:string,
}

interface userType{
    username: string;
    salt:string;
    id:string | number
}

async function forgot_password(fastify:FastifyInstance, opts:FastifyPluginOptions)
{
    const max_age_temp = process.env.max_age_temp;
    const exp_temp = process.env.expire_temp
    if (!max_age_temp || exp_temp)
        throw new Error("Missing cridenntials");
    fastify.route<{Body:body_type}>({
        method:"PUT",
        url:'/api/user/forgot-password',
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
            const {email} = request.body || {};
            if (!email)
            {
                return reply.code(400).send(
                    {
                        success: false,
                        message: "empty field."
                    })
            }
            try{
                const getUser = fastify.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as userType | undefined;
                if (!getUser)
                {
                    return reply.code(401).send({
                        success: false,
                        message: "unregistred email address."
                    })
                }
                const newCode = await fastify.randomCode.genCode(6, 6);
                const hashCode = await fastify.crypt_pass.getHash(newCode, getUser.salt);
                fastify.db.prepare("UPDATE users SET ResetCode = ?, usedCode=? WHERE email = ?").run(hashCode, 0, email);
				const mailOptions = {
					from: '"PONGFINITY" <no-reply@ft_transcendance.com>',
					to: email,
					subject: 'Your Reset Code',
					text: `Your reset code is: ${newCode}. This code will expire in 10 minutes. 
							Please enter this code on the password reset page to continue.`,
					html: `
						<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
							<h2>Password Reset Request</h2>
							<p>We received a request to reset the password for your account.</p>
							<p>Your <strong>6-digit verification code</strong> is:</p>
							<div style="font-size: 24px; font-weight: bold; background-color: #f4f4f4; padding: 10px; margin: 15px 0; display: inline-block; border-radius: 5px;">
								${newCode}
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
						path:'/api/user/reset-password',
						httpOnly: true,
						sameSite:'lax',
						maxAge: Number(max_age_temp)
					})
                    return reply.code(200).send({
					success: true,
					message: 'The new password has been sent to your email.'
				});
            }catch(error)
            {
                return reply.code(404).send({
					success: false,
					message: "Internal server error: " + error
				})
            }
        }
    })
}

export default fp(forgot_password, {
    name: "forgot_password"
})