import Input from './input'
import { FiKey } from 'react-icons/fi'

interface CodeFieldsProps {
	className?:string,
	value:string,
	onChange:(e:any)=>void,
	onBlur?:() => void,
	error?:any,
	placeHolder?:string
}

const CodeField:React.FC<CodeFieldsProps> = ({
	className = '',
	value,
	onChange,
	onBlur,
	error,
	placeHolder = 'text'
}) => {

	return (<Input
		className={className}
		icon={<FiKey size={18} />}
		type="text"
		name="text"
		placeholder = {placeHolder}
		value={value}
		onChange={onChange}
		onBlur={onBlur}
		error={error}
		/>)

}

export default CodeField;