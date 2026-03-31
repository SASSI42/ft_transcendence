import Input from './input'
import useForm from './useFormInput';
import PasswordField from './PasswordField';
import PingoHappy from '../../assets/pingo_happy.svg';
import { useApiSubmission } from '../../hooks/useApiSubmission';
import { validatePassword } from '../../utils/FormValidation'
import { useToast } from './toastContext';
import update_passwordApi from '../../api/update_paswordApi';

function Update_pass() {
	const {showToast} = useToast() as any;
	const password = useForm('', validatePassword);
	const {isSuccess, submissionError, submit } = useApiSubmission();

	const handleSubmit = async (e:any) => {
		e.preventDefault();
		
		const passworderror1 = validatePassword(password.oldValue);
		const passworderror2 = validatePassword(password.newValue);
		const passworderror3 = validatePassword(password.confirmValue);
		password.setError1(passworderror1);
		password.setError2(passworderror2);
		password.setError3(passworderror3);

		if (passworderror1 || passworderror2 || passworderror3) {
			return ;
		}
		const apiCall = () => update_passwordApi(password.oldValue, password.newValue, password.confirmValue);

		try {
			const response = await submit(apiCall);
			showToast(`${response.message}`, response.success ? 'success' : 'failure');
		} catch (error) {
			console.error("Submission failed, error shown to user.");
		}
	};

	return (
		<>
			<img className="w-12" src={PingoHappy} alt='Profile'/>
			<div className="m-3">
				<p className="font-bebas-neue text-h4">update password</p>
			</div>
			{submissionError && (<span className={isSuccess ? 'submission-success' : 'submission-error'}> {submissionError} </span>)}
			<form onSubmit={handleSubmit} className="flex flex-col gap-2 w-4/5 mb-5">
				<div className="flex flex-row flex-wrap gap-2">
				<PasswordField
					className="flex-[1.8] sm:min-w-[150px]"
					onChange={password.onChange1}
					onBlur={password.onBlur1}
					value={password.oldValue}
					error={password.error1}
					placeHolder={'Old password'}
				/>
				{password.error1 && <span className='error-span bg-red/15 -mt-[10px] rounded-b-lg' > {password.error1}</span>}

				<PasswordField
					className="flex-[1.8] sm:min-w-[150px]"
					onChange={password.onChange2}
					onBlur={password.onBlur2}
					value={password.newValue}
					error={password.error2}
					placeHolder={'New password'}
				/>
				{password.error2 && <span className='error-span bg-red/15 -mt-[10px] rounded-b-lg' > {password.error2}</span>}
				<PasswordField
					className="flex-[1.8] sm:min-w-[150px]"
					onChange={password.onChange3}
					onBlur={password.onBlur3}
					value={password.confirmValue}
					error={password.error3}
					placeHolder={'Confirm password'}
				/>
				{password.error3 && <span className='error-span bg-red/15 -mt-[10px] rounded-b-lg' > {password.error3}</span>}
				<Input
					className=" sm:min-w-[90px]"
					type="submit"
					name="submit"
					value="submit"
					error={password.error != ''}
					isLoading={false}
				/>
				</div>
				{password.error && <span className='error-span bg-red/15 -mt-[10px] rounded-b-lg' > {password.error}</span>}
				<p className={'font-bebas-neue p-2'}>Please use a diffrent password</p>
			</form>
		</>
	);
}

export default Update_pass;