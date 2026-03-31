import { FastifyInstance, FastifyPluginOptions} from "fastify"
import fp from 'fastify-plugin'

interface signInBody{
	email: string,
	password: string
}

interface userType{
    username: string;
	password: string;
    salt:string;
    id:string | number
	Avatar: string;
	twoFA: number;
}

interface userType_{
    username: string;
    id:string | number
}


async function signIN(fastify:FastifyInstance, opts:FastifyPluginOptions) {
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
	fastify.route<{Body:signInBody}>(
	{    
		method:"POST",
		url:'/api/user/signIn',
		schema :{
			body : fastify.getSchema('schema:user:create:signin:body'),
			response:{
			200: fastify.getSchema('schema:user:create:response'),
			'4xx':{
				type:"object",
				properties:{
					success: {type: 'boolean'},
					message: {type: 'string'}
					}
            	}
			}
		},
		handler: async function signIn(request, reply) {
			const {email, password} = request.body || {};

			if (!password || !email)
			{
				return reply.code(401).send({
					success: false,
					message: "empty field."
				})
			}
			const normalizedEmail = email.toLowerCase();
			const user = (fastify.db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail)) as userType | undefined;
			if (!user)
			{
				return reply.code(401).send({
					success:false,
					message:"This account is not registered."
				})
			}
			let isMatch:boolean = await fastify.crypt_pass.verify_pass(user.password, password, user.salt)
			if (isMatch === false)
			{
				return reply.code(401).send({
					success:false,
					message: "Incorrect password."
				})
			}
			try{
				
				if (user.twoFA === 0)
				{
					const load = {"sub":user.id, "name":user.username};
					const accessToken = fastify.jwt.sign(load, {expiresIn: String(exp_acc)});
					const refreshToken = fastify.jwt.sign(load, {expiresIn: String(exp_ref)});
				
					fastify.db.prepare("UPDATE users SET token = ? WHERE email = ?").run(refreshToken, normalizedEmail);
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
				}
				return(reply.code(200).send({
					"status":true,
					"success":true,
					"message":"Signed-in successfuly.",
					"user":{
						"id":user.id,
						"username":user.username,
						"email":normalizedEmail,
					},
					"twoFactor":user.twoFA,
					"avatar":`${user.Avatar}`,
				}))
			}catch(error)
			{
				request.log.error(error);
				return reply.code(404).send({
					success:false,
					message:"Internel server error."
				})
			}
		}
	})

	fastify.route(
	{    
		method:"POST",
		url:'/api/user/refresh',
		handler:async function refresh(request, reply){
			const RefreshToken = request.cookies.refresh_token;
			if (!RefreshToken){
				return reply.code(401).send({
					message: 'No refresh token'
				})}
				try{
					let decoded
					try{
						decoded = await fastify.jwt.verify(RefreshToken);
					}catch(error)
					{
						request.log.error(error);
						return reply.code(400).send({
							success: false,
							message: "The refresh_token is expired logout and login again"
						})
					}
					const user = fastify.db.prepare("SELECT * FROM users WHERE id = ? AND token = ?").get(decoded.sub, RefreshToken) as userType_ | undefined;
					if (!user)
						throw new Error('Token revoked');
					
					const load = {"sub":user.id, "name":user.username};
					const newAccessToken = fastify.jwt.sign(load, {expiresIn: String(exp_acc)});
					
					
				reply.setCookie('access_token', newAccessToken, {
					path: '/',
					httpOnly: true,
					secure: false,
					sameSite: 'lax',
					maxAge: Number(max_acc_val)
				})
				return reply.code(200).send({success: true, message: "successfuflly updated"})
			}catch(err)
			{
				return reply.code(401).send({
					message: "Invalid session"
				})
			}
		}
	})

	fastify.route<{Body:signInBody}>({    
	method:"POST",
	url:'/api/user/logout',
	handler: async function log_out(request, reply) {
		try {
			const Token = request.cookies.access_token;
	
			if (Token) {
				const decoded = await fastify.jwt.verify(Token) as any;
				fastify.db.prepare("UPDATE users SET token = ? WHERE id = ?").run(null, decoded.sub);
			}
		} catch (err) {
			request.log.warn("Logout attempted with invalid or expired token");
		} finally {
			reply.clearCookie('access_token');
			reply.clearCookie('oauth2-redirect-state', {path:"/login"});
			reply.clearCookie('refresh_token', {path: '/api/user/refresh'});
	
			return reply.code(200).send({
				success: true,
				message: "successfully logOut"
			});
		}
	}
	})
}
export default fp(signIN, {
	name:'signin'
})