import { useState } from "react";

function useForm(initvalue:any, validationFunc:any) {
	const [value, setValue] = useState(initvalue);
	const [oldValue, setOldValue] = useState(initvalue);
	const [newValue, setNewValue] = useState(initvalue);
	const [confirmValue, setConValue] = useState(initvalue);

	const [error, setError] = useState('');
	const [error1, setError1] = useState('');
	const [error2, setError2] = useState('');
	const [error3, setError3] = useState('');

	const onChange = (e:any) => {
		setValue(e.target.value);
		if (error) {
			setError('');
		}
	};

	const onChange1 = (e:any) => {
		setOldValue(e.target.value);
		if (error1) {
			setError1('');
		}
	};

	const onChange2 = (e:any) => {
		setNewValue(e.target.value);
		if (error2) {
			setError2('');
		}
	};

	const onChange3 = (e:any) => {
		setConValue(e.target.value);
		if (error3) {
			setError3('');
		}
	};
	const onBlur = () => {
		const error = validationFunc(value);
		setError(error);
	};

	const onBlur1 = () => {
		const error1 = validationFunc(oldValue);
		setError1(error1);
	};
	const onBlur2 = () => {
		const error2 = validationFunc(newValue);
		setError2(error2);
	};
	const onBlur3 = () => {
		const error3 = validationFunc(confirmValue);
		setError3(error3);
	};
	return {
		value,
		oldValue,
		newValue,
		confirmValue,
		error,
		error1,
		error2,
		error3,
		onChange,
		onChange1,
		onChange2,
		onChange3,
		onBlur,
		onBlur1,
		onBlur2,
		onBlur3,
		setValue,
		setOldValue,
		setNewValue,
		setConValue,
		setError,
		setError1,
		setError2,
		setError3,
	}
}

export default useForm;
