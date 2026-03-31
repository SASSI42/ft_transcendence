import Input from './input'
import default_avatar from '../../assets/default_avatar.png';
import PingoHappy from '../../assets/pingo_happy.svg';
import { useApiSubmission } from '../../hooks/useApiSubmission';
import { useToast } from './toastContext';
import update_avatarApi from '../../api/update_avatarApi';
import { useState } from 'react';

function Update_avatar() {
	const {showToast} = useToast() as any;
	const {submit } = useApiSubmission();
	const [avatars, setAvatar] = useState('');
	const [previewUrl, setPreviewUrl] = useState(default_avatar);
	const [clickk, setClick] = useState(false);

	const handleSubmit = async (e:any) => {
		e.preventDefault();
	};
	
	const handlerr = async () =>
	{
		if (!clickk && avatars)
		{
			setClick(true);
			const apiCall = () => update_avatarApi(avatars);
			try {
				const response = await submit(apiCall);
				showToast(`${response.message}`, response.success ? 'success' : 'failure');
				if (response.success)
					window.location.reload();
				return;
			} catch (error) {
				console.error("Submission failed, error shown to user.");
			}
		}
		else
			showToast(`${"No image uploaded or the image already uploaded"}`, false ? 'success' : 'failure');
	}
	return (
		<>
			<img className="w-12 mb-3" src={PingoHappy} alt='Profile'/>
			<p className="font-bebas-neue text-h4">update avatar</p>
			<div className="m-6">
				<img className="w-[150px] h-[120px] bg-white rounded-3xl" src={previewUrl} alt='Profile'/>
			</div>
			<form onSubmit={handleSubmit} className="flex flex-col gap-2 w-4/5">
				<div className="flex flex-row flex-wrap gap-2">
				<Input
					className=" sm:min-w-[90px]"
					type="file"
					name="file"
					onChange={(e:any)=>{
						setClick(false);
						const file = e.target.files?.[0];
						if (file.size > (5 * 1024 * 1024))
						{
							showToast(`${"the size of the file is too large"}`, false ? 'success' : 'failure');
							return;
						}
						setAvatar(file);
						const reader = new FileReader();
						reader.onloadend = () => {
							if (typeof reader.result === 'string')
								setPreviewUrl(reader.result);
						};
						reader.readAsDataURL(file);
					}}
				/>
				<button
					className = {`${clickk ? "bg-emerald-400 text-white" : "bg-cyan-300"} text-black mb-6 w-full h-[40px] rounded-md font-bebas-neue`}
					type="submit"
					name="submit"
					onClick={handlerr}
					>update the avatar
				</button>
				</div>
				<p className={'font-bebas-neue'}>have a nice day</p>
			</form>
		</>
	);
}

export default Update_avatar;