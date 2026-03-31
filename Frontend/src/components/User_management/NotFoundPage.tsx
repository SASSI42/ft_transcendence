import PingoSad from '../../assets/pingo_sad.svg';

function NotFoundPage() {
  return (
    <>
      <img className="w-11 " src={PingoSad} alt='Profile'/>
      <div className="m-2">
        <p className="font-bebas-neue text-h4 text-rose-400 mx-6">Code : 404</p>
        <p className="text-h1body font-bebas-neue">the page doesn't exist !</p>
      </div>
    </>
  )
}

export default NotFoundPage