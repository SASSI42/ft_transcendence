import Input from './input'
import useForm from './useFormInput';
import PingoHappy from '../../assets/pingo_happy.svg';
import { useApiSubmission } from '../../hooks/useApiSubmission';
import {validateUsername } from '../../utils/FormValidation'
import { useToast } from './toastContext';
import update_usernameApi from '../../api/update_usernameApi';
import UsernameField from './UsernameField';

function Update_username() {
	const {showToast} = useToast() as any;
	const username = useForm('', validateUsername);
	const {isSuccess, submissionError, submit } = useApiSubmission();

	const handleSubmit = async (e:any) => {
		e.preventDefault();
		
		const usernameError2 = validateUsername(username.newValue);
		const usernameError3 = validateUsername(username.confirmValue);
		username.setError(usernameError2);
		username.setError(usernameError3);

		if (usernameError2 || usernameError3) {
			return ;
		}
		const apiCall = () => update_usernameApi(username.newValue, username.confirmValue);

		try {
			const response = await submit(apiCall);
			if (response.success)
				window.location.reload();
			showToast(`${response.message}`, response.success ? 'success' : 'failure');
			return;
		} catch (error) {
			console.error("Submission failed, error shown to user.");
		}
	};

	return (
		<>
			<img className="w-12" src={PingoHappy} alt={'avatar'}/>
			<div className="m-3">
				<p className="font-bebas-neue text-h4">update username</p>
			</div>
			{submissionError && (<span className={isSuccess ? 'submission-success' : 'submission-error'}> {submissionError} </span>)}
			<form onSubmit={handleSubmit} className="flex flex-col gap-2 w-4/5">
				<div className="flex flex-row flex-wrap gap-2">
				<div className="flex flex-row flex-wrap gap-2">
					<UsernameField
						onChange={username.onChange2}
						onBlur={username.onBlur2}
						value={username.newValue}
						error={username.error2}
						placeHolder='new username'
						/>
					{username.error2 && <span className='error-span' > {username.error2}</span>}
					<UsernameField
						onChange={username.onChange3}
						onBlur={username.onBlur3}
						value={username.confirmValue}
						error={username.error3}
						placeHolder='Confirm username'
						/>
					{username.error3 && <span className='error-span' > {username.error3}</span>}
				</div>
				<Input
					className=" sm:min-w-[90px]"
					type="submit"
					name="submit"
					value="submit"
					error={(username.error2 || username.error3) != ''}
					isLoading={false}
				/>
				</div>
				<p className={'font-bebas-neue'}>Please use a diffrent username</p>
			</form>
		</>
	);
}

export default Update_username;