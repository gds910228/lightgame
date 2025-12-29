import { useState } from 'react'
import SEO from '../components/SEO'
import ToastNotification from '../components/ToastNotification'

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission (replace with actual API call or EmailJS)
    setTimeout(() => {
      setToastMessage('Thank you for your message! We will get back to you soon.')
      setShowToast(true)
      setFormData({ name: '', email: '', subject: '', message: '' })
      setIsSubmitting(false)
    }, 1000)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <SEO
        title="Contact Us - LightGame"
        description="Get in touch with the LightGame team. We'd love to hear from you!"
      />

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">Contact Us</h1>
        <p className="text-gray-600 text-lg">
          Have a question, suggestion, or feedback? We'd love to hear from you!
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Get in Touch</h2>

          <div className="space-y-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
                <i className="fa-solid fa-envelope text-primary-600 text-xl"></i>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Email</h3>
                <a href="mailto:1479333689@qq.com" className="text-primary-600 hover:underline">
                  1479333689@qq.com
                </a>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center mr-4">
                <i className="fa-brands fa-github text-secondary-600 text-xl"></i>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">GitHub</h3>
                <a href="https://github.com/gds910228" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                  gds910228
                </a>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <i className="fa-solid fa-clock text-green-600 text-xl"></i>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 mb-1">Response Time</h3>
                <p className="text-gray-600 text-sm">We typically respond within 24-48 hours</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3">Follow Us</h3>
            <div className="flex space-x-4">
              <a href="https://x.com/ArcherRealAI" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-primary-100 transition-colors" aria-label="X (Twitter)">
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://github.com/gds910228" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-primary-100 transition-colors" aria-label="GitHub">
                <i className="fa-brands fa-github text-gray-600 text-xl"></i>
              </a>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">Send us a Message</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                placeholder="Your name"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <select
                id="subject"
                name="subject"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                value={formData.subject}
                onChange={handleChange}
              >
                <option value="">Select a subject</option>
                <option value="general">General Inquiry</option>
                <option value="game-request">Game Request</option>
                <option value="bug-report">Bug Report</option>
                <option value="feedback">Feedback</option>
                <option value="business">Business Inquiry</option>
                <option value="copyright">Copyright Issue</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition resize-none"
                placeholder="Tell us more about your inquiry..."
                value={formData.message}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn btn-primary py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                  Sending...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <i className="fa-solid fa-paper-plane mr-2"></i>
                  Send Message
                </span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Frequently Asked Questions</h2>

        <div className="space-y-4">
          <details className="group">
            <summary className="flex justify-between items-center cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <span className="font-medium text-gray-800">Are all games really free?</span>
              <i className="fa-solid fa-chevron-down text-gray-500 group-open:rotate-180 transition-transform"></i>
            </summary>
            <p className="mt-3 px-4 text-gray-600">
              Yes! All games on LightGame are completely free to play. No downloads, no registrations, no hidden fees or in-game purchases.
            </p>
          </details>

          <details className="group">
            <summary className="flex justify-between items-center cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <span className="font-medium text-gray-800">Can I request a new game?</span>
              <i className="fa-solid fa-chevron-down text-gray-500 group-open:rotate-180 transition-transform"></i>
            </summary>
            <p className="mt-3 px-4 text-gray-600">
              Absolutely! We welcome game suggestions. Use the contact form above and select "Game Request" as the subject.
            </p>
          </details>

          <details className="group">
            <summary className="flex justify-between items-center cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <span className="font-medium text-gray-800">I found a bug. What should I do?</span>
              <i className="fa-solid fa-chevron-down text-gray-500 group-open:rotate-180 transition-transform"></i>
            </summary>
            <p className="mt-3 px-4 text-gray-600">
              Please report any bugs through our contact form. Select "Bug Report" as the subject and describe the issue in detail.
            </p>
          </details>

          <details className="group">
            <summary className="flex justify-between items-center cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <span className="font-medium text-gray-800">Can I advertise on LightGame?</span>
              <i className="fa-solid fa-chevron-down text-gray-500 group-open:rotate-180 transition-transform"></i>
            </summary>
            <p className="mt-3 px-4 text-gray-600">
              For business inquiries and advertising opportunities, please contact us using the form above with "Business Inquiry" selected.
            </p>
          </details>
        </div>
      </div>

      {showToast && (
        <ToastNotification
          message={toastMessage}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  )
}

export default ContactUs
