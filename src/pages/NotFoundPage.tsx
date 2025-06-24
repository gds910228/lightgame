import { Link } from 'react-router-dom'

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="text-center">
        <div className="text-primary-500 text-9xl font-bold mb-4 animate-float">404</div>
        <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
        <p className="text-gray-600 mb-8">
          Sorry, the page you are looking for doesn't exist or has been moved.
        </p>
        <Link 
          to="/" 
          className="btn btn-primary inline-flex items-center group"
        >
          <i className="fas fa-home mr-2 group-hover:animate-wiggle"></i>
          Go Home
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage 