import { Link } from 'react-router-dom';
import PingoSad from '../../assets/pingo_sad.svg';
import EmailField from './EmailField';
import validateEmail from '../../utils/FormValidation';
import useForm from './useFormInput';
import Input from './input';
import ForgotPassword from '../../api/forgotPasswordApi';
import { useApiSubmission } from '../../hooks/useApiSubmission';
import { useToast } from './toastContext';
import { useNavigate } from 'react-router-dom';


function PasswordLost() {
  const email = useForm('', validateEmail);
	const {isSuccess, submissionError, submit } = useApiSubmission();
    const { showToast } = useToast() as any;
    	const navigate = useNavigate();
    
  const handleSubmit = async (e:any) => {
		e.preventDefault();

		const mailerror = validateEmail(email.value.trim())

		email.setError(mailerror);

		if (mailerror) {
			return ;
		}
		  const apiCall = () => ForgotPassword(email.value.trim());
      
      try {
        const response = await submit(apiCall);
        showToast(`${response.message}`, response.success ? 'success' : 'failure');
        response.success && navigate('/reset-password');
      
		} catch (error) {
			console.error("Submission failed, error shown to user.");
		}
	};

  return (
    <>
      <img className="w-12" src={PingoSad} alt='Profile'/>
      <div className="m-3">
        <p className="font-bebas-neue text-h4">Forgot your password?</p>
        <p className="text-h5body">Enter the email linked to your account and we will send you reset instructions.</p>
      </div>
      {submissionError && (<span className={isSuccess ? 'submission-success' : 'submission-error'}> {submissionError} </span>)}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-4/5">
        <div className={`flex flex-col gap-0 rounded-lg ${email.error ? "bg-red/15" : ""}`}>
          <EmailField
          onChange={email.onChange}
          onBlur={email.onBlur}
          value={email.value}
          error={email.error}
          />
          {email.error && <span className='error-span' > {email.error}</span>}
			  </div>
		<Input
		type="submit"
		name="submit"
		value="Send the code"
    error={email.error != ''}
    isLoading={false}
		/>
		<div className="flex flex-row items-center justify-evenly">
			<hr className="w-1/3 border-bgsecondary" />
			<p className="text-h6body">or</p>
			<hr className="w-1/3 border-bgsecondary" />
		</div>
        <div className="flex flex-row flex-wrap mb-5 justify-evenly font-bebas-neue">
          <Link to="/signin" className="w-full secondary-button">
          sign in
          </Link>
        </div>
      </form>
    </>
  )
}

export default PasswordLost
