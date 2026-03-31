import Input from './input'
import { FiUser } from 'react-icons/fi'

interface UsernameFieldsProps {
	className?:string,
	value:string,
	onChange:(e:any)=>void,
	onBlur?:() => void,
	error?:any,
	placeHolder?:string
}

const UsernameField:React.FC<UsernameFieldsProps> = ({
	className = '',
	value,
	onChange,
	onBlur,
	error,
	placeHolder = 'username'
}) => {

	return (<Input
		className={className}
		icon={<FiUser size={18} />}
		name="username"
		placeholder={placeHolder}
		value={value}
		onChange={onChange}
		onBlur={onBlur}
		error={error}
		/>)
}

export default UsernameField;