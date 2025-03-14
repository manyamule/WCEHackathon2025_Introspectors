'use client';

const Footer = () => {
    return (
        <>

         <div className="w-full h-1 mb-2 bg-green-100"></div>

            <footer className="text-gray-600 body-font">
                <div className="container px-5 py-8 mx-auto flex items-center justify-center sm:flex-row flex-col">
                    <a className="flex title-font font-medium items-center md:justify-start justify-center text-gray-900">
                        <i className="fa-solid fa-seedling text-green-600 text-xl"></i>
                        <span className="ml-3 text-base tracking-wide text-green-800">Air Gaurd</span>
                    </a>
                </div>
            </footer>

        </>
    )
}
export default Footer