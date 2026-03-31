
export default function validateMail(mail : string) : string {
	mail = mail.trim();
	if (!mail)
		return ("Email address is required.");
	if (mail.length > 254)
		return ("Email address is too long.");
	const MailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!MailRegex.test(mail))
		return ("Please enter a valid email format (user@example.com).");

	return "";
};

export function validatePassword(password : string) : string {

	if (!password.trim())
		return ("Password is required.");
	if (password.length < 8 || password.length > 72)
		return ("Password must be between 8 and 72 characters long.");
	
	let PasswordRegex = /[A-Z]/;
	if (!PasswordRegex.test(password))
		return ("Must include at least one uppercase letter.");
	
	PasswordRegex = /[a-z]/;
	if (!PasswordRegex.test(password))
		return ("Must include at least one lowercase letter.");

	PasswordRegex = /[0-9]/;
	if (!PasswordRegex.test(password))
		return ("Must include at least one number.");

	PasswordRegex = /[!@#$%^&*]/;
	if (!PasswordRegex.test(password))
		return ("Must include at least one special character.");

	return "";
}

export function validateCode(Code : string) : string 
{
	if (!Code.trim())
		return ("auth code is required.");
	const codeRegex = /^\d{6}$/;
	if (!codeRegex.test(Code))
		return ("auth Code must be exactly 6 digits.");
	return "";
}

export function validateUsername(username : string) : string {
	username = username.trim();
	if (!username)
		return ("Username is required.");
	if (username.length > 20 || username.length < 3)
		return ("Username must be between 3 and 20 characters long.");
	const UsernameRegex = /^[a-zA-Z0-9_]+$/;
	if (!UsernameRegex.test(username))
		return ("Only letters, numbers, and underscores are allowed.");

	return "";
}

export function validateToken(token: string){
	const tokenRegex = /^[a-zA-Z0-9]{32}$/;
	if (!token || !tokenRegex.test(token))
		return('The security token is invalid. Please ensure you copied the entire link.');
	return ('');
}
