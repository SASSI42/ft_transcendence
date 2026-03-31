import Input from './input'
import { FiLock } from 'react-icons/fi'

interface PassFieldsProps {
	className?:string,
	value:any,
	type?:string,
	onChange:(e:any)=>void,
	onBlur?:() => void,
	error?:any,
	placeHolder?:string
}

const PasswordField:React.FC<PassFieldsProps> = ({
	className = '',
	value,
	type = 'password',
	onChange,
	onBlur,
	error,
	placeHolder = 'Password'
}) => {
	return (<Input
		className={className}
		icon={<FiLock size={18} />}
		type = {type}
		name="password"
		placeholder={placeHolder}
		value={value}
		onChange={onChange}
		onBlur={onBlur}
		error={error}
		/>)
}

export default PasswordField