import Input from './input'
import useForm from './useFormInput';
import EmailField from './EmailField';
import PasswordField from './PasswordField';
import PingoHappy from '../../assets/pingo_happy.svg';
import { useApiSubmission } from '../../hooks/useApiSubmission';
import validateEmail, { validatePassword } from '../../utils/FormValidation'
import { useToast } from './toastContext';
import update_emailApi from '../../api/update_emailApi';

function Update_email() {
	const {showToast} = useToast() as any;
	const email = useForm('', validateEmail);
	const password = useForm('', validatePassword);
	const {isSuccess, submissionError, submit } = useApiSubmission();

	const handleSubmit = async (e:any) => {
		e.preventDefault();
		
		const passwordError = validatePassword(password.value);
		const emailError2 = validateEmail(email.newValue);
		const emailError3 = validateEmail(email.confirmValue);
		password.setError(passwordError);
		email.setError2(emailError2);
		email.setError3(emailError3);

		if (passwordError || emailError2 || emailError3) {
			return ;
		}
		const apiCall = () => update_emailApi(password.value, email.newValue, email.confirmValue);
		try {
			const response = await submit(apiCall);
			showToast(`${response.message}`, response.success ? 'success' : 'failure');
		} catch (error) {
			console.error("Submission failed, error shown to user.");
		}
	};
	return (
		<>
			<img className="w-12" src={PingoHappy} alt='Avatar'/>
			<div className="m-3">
				<p className="font-bebas-neue text-h4">update email</p>
			</div>
			{submissionError && (<span className={isSuccess ? 'submission-success' : 'submission-error'}> {submissionError} </span>)}
			<form onSubmit={handleSubmit} className="flex flex-col gap-2 w-4/5">
				<div className="flex flex-row flex-wrap gap-2 pb-5">
				<div className="flex flex-row flex-wrap gap-2">
					<PasswordField
						className=" sm:min-w-[90px]"
						onChange={password.onChange}
						onBlur={password.onBlur}
						value={password.value}
						error={password.error}
						placeHolder='Password for the account'
					/>
					{password.error && <span className='error-span bg-red/15 -mt-[10px] rounded-b-lg' > {password.error}</span>}
					<EmailField
						className=" sm:min-w-[90px]"
						onChange={email.onChange2}
						onBlur={email.onBlur2}
						value={email.newValue}
						error={email.error2}
						placeHolder='New email address'
					/>
					{email.error2 && <span className='error-span' > {email.error2}</span>}
					<EmailField
						onChange={email.onChange3}
						onBlur={email.onBlur3}
						value={email.confirmValue}
						error={email.error3}
						placeHolder='Confirm email address'
					/>
					{email.error3 && <span className='error-span' > {email.error3}</span>}
				<Input
					className=" sm:min-w-[90px] "
					type="submit"
					name="submit"
					value="submit"
					error={password.error != ''}
					isLoading={false}
					/>
				</div>
				</div>
				<p className={'font-bebas-neue pb-5'}>Please use a diffrent email address</p>
			</form>
		</>
	);
}

export default Update_email;