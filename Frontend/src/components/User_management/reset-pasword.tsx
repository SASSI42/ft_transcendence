import PingoHappy from '../../assets/pingo_happy.svg';
import useForm from './useFormInput';
import PasswordField from './PasswordField';
import CodeField from './CodeField';
import { validatePassword, validateCode } from '../../utils/FormValidation';
import Input from './input';
import RecoverPasswordApi from '../../api/recoverPassword';
import { useApiSubmission } from '../../hooks/useApiSubmission';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from './toastContext';


function PasswordReset() {
	const password = useForm('', validatePassword);
	const code = useForm('', validateCode);
  const navigate = useNavigate();
  const { showToast } = useToast() as any;
	const {isSuccess, submissionError, submit } = useApiSubmission();

	const handleSubmit = async (e:any) => {
		e.preventDefault();

	const codeError = validateCode(code.value)
    const passworderror = validatePassword(password.newValue)
    const confirmPasswordErr = validatePassword(password.confirmValue);

	code.setError(codeError);
    password.setError2(passworderror);
    password.setError3(confirmPasswordErr);

		if (codeError || passworderror || confirmPasswordErr) {
			return ;
		}
		const apiCall = () => RecoverPasswordApi(code.value, password.newValue, password.confirmValue);

		try {
      const response = await submit(apiCall);
			showToast(`${response.message}`, response.success ? 'success' : 'failure');
			response.success && navigate('/signin');
		} catch (error) {
			console.error("Submission failed, error shown to user.");
		}
	};

  return (
    <>
      <img className="w-12" src={PingoHappy} alt='Profile'/>
      <div className="m-3">
        <p className="font-bebas-neue text-h4">Complete Your Password Update</p>
        <p className="text-h5body">This will immediately replace your old password and grant you access to your account.</p>
      </div>
      {submissionError && (<span className={isSuccess ? 'submission-success' : 'submission-error'}> {submissionError} </span>)}
      <form className="flex flex-col gap-2 w-4/5" onSubmit={handleSubmit}>
        <div className={`flex flex-col gap-0 rounded-lg ${code.error ? "bg-red/15" : ""}`}>
			<CodeField
			onChange={code.onChange}
			onBlur={code.onBlur}
			value={code.value}
			error={code.error}
			placeHolder='reset-code'
          />
          {code.error && <span className='error-span' > {code.error}</span>}
          </div>
        <div className={`flex flex-col gap-0 rounded-lg ${password.error2 ? "bg-red/15" : ""}`}>
			<PasswordField
			onChange={password.onChange2}
			onBlur={password.onBlur2}
			value={password.newValue}
			error={password.error2}
			placeHolder='New password'
          />
          {password.error2 && <span className='error-span' > {password.error2}</span>}
          </div>
        <div className={`flex flex-col gap-0 rounded-lg ${password.error3 ? "bg-red/15" : ""}`}>
			<PasswordField
			onChange={password.onChange3}
			onBlur={password.onBlur3}
			value={password.confirmValue}
			error={password.error3}
			placeHolder='Confirm password'
          />
          {password.error3 && <span className='error-span' >{password.error3}</span>}
        </div>
		<Input
		    type="submit"
		    name="submit"
		    value="update password"
			error={(code.error && password.error2 && password.error3) != ''}
			isLoading={false}
		    />
        <div className="flex flex-row flex-wrap mb-5 justify-evenly font-bebas-neue">
          <Link to="/forgot-password" className="w-full secondary-button">
		  	resend code
          </Link>
        </div>
      </form>
    </>
  )
}

export default PasswordReset
