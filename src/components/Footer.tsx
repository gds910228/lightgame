import { Link } from 'react-router-dom'

const Footer = () => {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="bg-gray-100 py-8 border-t border-gray-200">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Link to="/" className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                <i className="fas fa-gamepad text-white text-sm"></i>
              </div>
              <span className="text-xl font-bold ml-2 text-gray-900">LightGame</span>
            </Link>
            <p className="text-gray-600 mt-2 text-sm">
              A beautifully designed, minimalist game sanctuary for busy professionals.
            </p>
          </div>
          
          <div className="flex flex-col items-center md:items-end">
            <div className="flex gap-4 mb-3">
              <a href="#" className="text-gray-500 hover:text-primary-600 transition-colors">
                <i className="fab fa-github text-xl"></i>
              </a>
              <a href="#" className="text-gray-500 hover:text-primary-600 transition-colors">
                <i className="fab fa-twitter text-xl"></i>
              </a>
              <a href="#" className="text-gray-500 hover:text-primary-600 transition-colors">
                <i className="fab fa-linkedin text-xl"></i>
              </a>
            </div>
            <p className="text-gray-500 text-sm">
              &copy; {currentYear} LightGame. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer 