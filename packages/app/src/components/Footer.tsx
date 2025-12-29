import { Link } from 'react-router-dom'
import { useState } from 'react'
import Modal from './Modal'
import FeedbackForm from './FeedbackForm'
import { useAllGames } from '../hooks/useGames'

const Footer = () => {
  const currentYear = new Date().getFullYear()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { games } = useAllGames()
  
  const openFeedbackModal = () => setIsModalOpen(true)
  const closeFeedbackModal = () => setIsModalOpen(false)
  
  return (
    <footer className="bg-gray-100 py-8 border-t border-gray-200">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Link to="/" className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                <i className="fa-solid fa-gamepad text-white text-sm"></i>
              </div>
              <span className="text-xl font-bold ml-2 text-gray-900">LightGame</span>
            </Link>
            <p className="text-gray-600 mt-2 text-sm">
              A beautifully designed, minimalist game sanctuary for busy professionals.
            </p>
          </div>
          
          <div className="flex flex-col items-center md:items-end">
            <div className="flex gap-4 mb-3">
              <a href="https://github.com/gds910228" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-primary-600 transition-colors text-xl" aria-label="GitHub">
                <i className="fa-brands fa-github"></i>
              </a>
              <a href="https://x.com/ArcherRealAI" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-primary-600 transition-colors text-xl" aria-label="X (Twitter)">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <button
                onClick={openFeedbackModal}
                className="text-gray-500 hover:text-primary-600 transition-colors flex items-center text-xl"
                aria-label="Submit Feedback"
              >
                <i className="fa-solid fa-comment-dots mr-1"></i>
                <span className="text-sm">Feedback</span>
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-2">
              &copy; {currentYear} LightGame. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs">
              <Link to="/privacy-policy" className="text-gray-500 hover:text-primary-600 transition-colors">
                Privacy Policy
              </Link>
              <span className="text-gray-300">|</span>
              <Link to="/terms-of-service" className="text-gray-500 hover:text-primary-600 transition-colors">
                Terms of Service
              </Link>
              <span className="text-gray-300">|</span>
              <Link to="/contact" className="text-gray-500 hover:text-primary-600 transition-colors">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* 反馈模态窗口 */}
      <Modal isOpen={isModalOpen} onClose={closeFeedbackModal}>
        <FeedbackForm games={games || []} onClose={closeFeedbackModal} />
      </Modal>
    </footer>
  )
}

export default Footer 