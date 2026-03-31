import Input from './input'
import useForm from './useFormInput';
import {Link} from 'react-router-dom';
import PingoHappy from '../../assets/pingo_happy.svg';
import { useApiSubmission } from '../../hooks/useApiSubmission';
import { validateCode} from '../../utils/FormValidation'
import { useToast } from './toastContext';
import twoFactor from '../../api/twoFactorApi';
import CodeField from './CodeField';


function TwoFactor() {
	const {showToast} = useToast() as any;
	const password = useForm('', validateCode);
	const {isSuccess, submissionError, submit } = useApiSubmission();


	const handleSubmit = async (e:any) => {
		e.preventDefault();

		const passworderror = ''

		password.setError(passworderror);

		if (passworderror) {
			return ;
		}
		const apiCall = () => twoFactor(password.value);

		try {
			const response = await submit(apiCall);
			showToast(`${response.message}`, response.success ? 'success' : 'failure');

			if (response.success === true)
			{
				window.location.assign('/user_profile');
			}
			return;
		} catch (error) {
			console.error("Submission failed, error shown to user.");
		}
	};

	return (
		<>
			<img className="w-12" src={PingoHappy} alt='Profile'/>
			<div className="m-3">
				<p className="text-h5 font-bebas-neue">Enter the code sent to your email.</p>
			</div>
			{submissionError && (<span className={isSuccess ? 'submission-success' : 'submission-error'}> {submissionError} </span>)}
			<form onSubmit={handleSubmit} className="flex flex-col gap-2 w-4/5">
				<div className={`flex flex-col gap-0 rounded-lg ${password.error ? "bg-red/15" : ""}`}>
				<CodeField
					className="flex-[1.8] sm:min-w-[150px]"
					onChange={password.onChange}
					onBlur={password.onBlur}
					value={password.value}
					error={password.error}
					placeHolder='auth-code'
				/>
				{password.error && <span className='error-span bg-red/15 -mt-[10px] rounded-b-lg' > {password.error}</span>}
				</div>
				<div className="flex flex-row flex-wrap gap-2">
				<Input
					className="flex-[1.2] sm:min-w-[90px]"
					type="submit"
					name="submit"
					value="verify"
					error={password.error !== ''}
					isLoading={false}
				/>
				</div>
				        <div className="flex flex-row flex-wrap mb-5 justify-evenly font-bebas-neue">
          <Link to="/signin" className="w-full secondary-button">
		  	sign in
          </Link>
        </div>
			</form>
		</>
	);
}

export default TwoFactor;