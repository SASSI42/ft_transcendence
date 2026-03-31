import { FastifyInstance, FastifyPluginOptions} from "fastify"
import fp from 'fastify-plugin'

type signupBody = {
    username: string,
    email: string,
    password: string
}

async function signUP(fastify:FastifyInstance, opts:FastifyPluginOptions) {
  fastify.route<{Body:signupBody}>(
    {    
      method:"POST",
      url: '/api/user/signUp',
      schema :{
        body : fastify.getSchema('schema:user:create:body'),
        response:{
        201: fastify.getSchema('schema:user:create:response:signUp'),
        '4xx':{
                type:"object",
                properties:{
                    success: {type: 'boolean'},
                    message: {type: 'string'}
                }
            }
         },
         
      },
      handler: async function createAccount(request, reply) {
        const {username, email, password} = request.body || {};
        if (!username || !email || !password)
            return reply.code(401).send({
            success:false,
            message: "empty field"})

        const normalizedEmail = email.toLocaleLowerCase();
        const usedEmail = fastify.db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail) as any | undefined;
        if (usedEmail)
        {
            return (reply.code(409).send({
                success: false,
                message: "The email address already in use."
            }))
        }
        const usedUsername = fastify.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any | undefined;
        if (usedUsername)
        {
            return (reply.code(409).send({
                success: false,
                message: "The username already in use."
            }))
        }
        try{

            const salt = await fastify.crypt_pass.getSalt() as string;
            const hashedPassword = await fastify.crypt_pass.getHash(password, salt) as string;
            const insert = fastify.db.prepare(`INSERT INTO users 
                (username, password, email, salt, token, twoFactorCode, ResetCode, usedCode, twoFA, Avatar, oauth2) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` 
            ).run(username, hashedPassword, normalizedEmail, salt, null, null, null, 0, 0, '/api/uploads/default_avatar.png', 0);
            const user = fastify.db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail) as any | undefined;
            if (!user)
            {
                return reply.code(409).send({
                    success:false,
                    message:"The account not created."
                })
            }
            return reply.code(201).send(
            {
                "success": true,
                "message": "Signed-up successfuly.",
            }
        );
        }catch(error){
         request.log.error(error);
         return reply.code(404).send({
            status : false,
            message : "can't create account"
         })
        }
    }
    })
}

export default fp(signUP, {
  name:'signup'
})