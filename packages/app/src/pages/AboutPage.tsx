import SEO from '../components/SEO'
import { Link } from 'react-router-dom'

const AboutPage = () => {
  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <SEO
        title="About Us - LightGame"
        description="Learn more about LightGame - your destination for quick, fun casual games."
        url="https://games.misitebo.win/about"
      />

      <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
        <h1 className="text-4xl font-bold mb-6 text-gray-900">
          About <span className="text-primary-500">LightGame</span>
        </h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-gray-700 text-lg mb-6">
            Welcome to LightGame – your destination for quick, fun casual games! We're passionate about bringing you the best selection of casual games that you can play anytime, anywhere.
          </p>

          <div className="bg-primary-50 border-l-4 border-primary-500 p-6 rounded-lg my-8">
            <h2 className="text-2xl font-bold text-primary-600 mb-3">Our Mission</h2>
            <p className="text-gray-700">
              To provide instant entertainment for everyone. Whether you're on a coffee break, waiting for the bus, or just need to relax, LightGame offers a variety of games that are free to play and require no downloads or sign-ups.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-8">What We Offer</h2>
          <ul className="space-y-3 text-gray-700 mb-6">
            <li className="flex items-start">
              <i className="fas fa-check-circle text-green-500 mt-1 mr-3 flex-shrink-0"></i>
              <span><strong>Instant Play:</strong> No downloads, no installations. Click and play!</span>
            </li>
            <li className="flex items-start">
              <i className="fas fa-check-circle text-green-500 mt-1 mr-3 flex-shrink-0"></i>
              <span><strong>Varied Categories:</strong> From puzzle games to action adventures, we have something for everyone.</span>
            </li>
            <li className="flex items-start">
              <i className="fas fa-check-circle text-green-500 mt-1 mr-3 flex-shrink-0"></i>
              <span><strong>Mobile Friendly:</strong> Optimized for play on desktop, tablet, and mobile devices.</span>
            </li>
            <li className="flex items-start">
              <i className="fas fa-check-circle text-green-500 mt-1 mr-3 flex-shrink-0"></i>
              <span><strong>Completely Free:</strong> All games are free to play, with no hidden costs or in-app purchases.</span>
            </li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mb-4 mt-8">Why Choose LightGame?</h2>
          <p className="text-gray-700 mb-4">
            We understand that your time is valuable. That's why we've curated a collection of games that are easy to pick up and play, but engaging enough to keep you entertained. Our platform is designed with simplicity in mind – no complicated sign-ups, no lengthy downloads, just pure gaming fun.
          </p>

          <div className="bg-gray-50 p-6 rounded-lg my-8">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Get in Touch</h3>
            <p className="text-gray-700 mb-4">
              Have feedback, suggestions, or just want to say hi? We'd love to hear from you!
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              <i className="fas fa-envelope"></i>
              Contact Us
            </Link>
          </div>

          <div className="border-t pt-8 mt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Legal</h3>
            <div className="flex flex-wrap gap-4">
              <Link to="/privacy-policy" className="text-primary-600 hover:text-primary-700">
                Privacy Policy
              </Link>
              <span className="text-gray-300">|</span>
              <Link to="/terms-of-service" className="text-primary-600 hover:text-primary-700">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link to="/" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium">
          <i className="fas fa-arrow-left"></i>
          Back to Games
        </Link>
      </div>
    </div>
  )
}

export default AboutPage
