import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Game } from '../types';
import { sendFeedbackEmail } from '../services/emailService';
import Select from 'react-select';

// 定义表单数据类型
interface FeedbackFormData {
  name: string;
  email: string;
  gameId: string;
  feedbackType: 'bug' | 'suggestion' | 'other';
  message: string;
  rating: string;
}

interface FeedbackFormProps {
  games: Game[];
  onClose: () => void;
}

// 反馈类型选项
const feedbackTypeOptions = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'other', label: 'Other' }
];

const FeedbackForm = ({ games, onClose }: FeedbackFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rating, setRating] = useState<number>(5); // 默认5星评分
  
  const { 
    register, 
    handleSubmit,
    control,
    formState: { errors },
    reset
  } = useForm<FeedbackFormData>();

  // 将游戏列表转换为Select组件需要的格式
  const gameOptions = [
    { value: 'website', label: 'Entire Website' },
    ...games.map(game => ({
      value: game.id,
      label: game.title
    }))
  ];

  // 处理星级评分变化
  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
  };

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');
    
    try {
      // 找到选择的游戏名称
      const selectedGame = games.find(game => game.id === data.gameId);
      const gameTitle = selectedGame ? selectedGame.title : 'Entire Website';
      
      // 准备要发送的数据 - 修改为与EmailJS模板完全匹配的参数名
      const templateParams = {
        from_name: data.name || 'Anonymous User',
        from_email: data.email,
        game: gameTitle,
        feedback_type: data.feedbackType === 'bug' ? 'Bug Report' : 
                     data.feedbackType === 'suggestion' ? 'Suggestion' : 'Other',
        message: data.message,
        email: '1479333689@qq.com',
        company_name: 'LightGame',
        company_email: '1479333689@qq.com',
        company_phone: 'N/A',
        rating: rating.toString() // 使用用户选择的评分
      };
      
      console.log('Sending feedback email, params:', templateParams);
      
      // 发送邮件
      const result = await sendFeedbackEmail(templateParams);
      
      console.log('Email sending result:', result);
      
      if (result.success) {
        setSubmitStatus('success');
        reset(); // 重置表单
        
        // 成功后3秒关闭表单
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        setSubmitStatus('error');
        setErrorMessage(result.error instanceof Error ? result.error.message : 'Unknown error');
        console.error('Feedback submission failed details:', result.error);
      }
    } catch (error) {
      console.error('Feedback submission failed:', error);
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 自定义Select样式
  const customSelectStyles = {
    control: (provided: any) => ({
      ...provided,
      borderColor: '#e5e7eb',
      borderRadius: '0.375rem',
      minHeight: '42px',
      boxShadow: 'none',
      '&:hover': {
        borderColor: '#d1d5db'
      }
    }),
    placeholder: (provided: any) => ({
      ...provided,
      color: '#9ca3af'
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#e5e7eb' : 'white',
      color: state.isSelected ? 'white' : '#374151',
      cursor: 'pointer'
    })
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Game Feedback</h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>
      
      {submitStatus === 'success' ? (
        <div className="text-center py-8">
          <div className="text-green-500 text-5xl mb-4">
            <i className="fas fa-check-circle"></i>
          </div>
          <h3 className="text-xl font-bold mb-2">Feedback Submitted</h3>
          <p className="text-gray-600 mb-4">Thank you for your feedback! We will process it as soon as possible.</p>
          <button
            onClick={onClose}
            className="bg-primary-500 text-white px-6 py-2 rounded-full hover:bg-primary-600 transition-colors"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 姓名字段 */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name (Optional)
            </label>
            <input
              id="name"
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="Your name"
              {...register('name')}
            />
          </div>
          
          {/* 邮箱字段 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              className={`w-full px-4 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-primary-500 focus:border-primary-500`}
              placeholder="Your email address"
              {...register('email', { 
                required: 'Please enter your email address',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Please enter a valid email address'
                }
              })}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>
          
          {/* 游戏选择 - 使用react-select */}
          <div>
            <label htmlFor="gameId" className="block text-sm font-medium text-gray-700 mb-1">
              Select Game <span className="text-red-500">*</span>
            </label>
            <Controller
              name="gameId"
              control={control}
              rules={{ required: 'Please select a game' }}
              render={({ field }) => (
                <Select
                  inputId="gameId"
                  options={gameOptions}
                  placeholder="-- Select a game --"
                  isClearable={false}
                  isSearchable={true}
                  styles={customSelectStyles}
                  value={gameOptions.find(option => option.value === field.value)}
                  onChange={(option) => field.onChange(option?.value)}
                  noOptionsMessage={() => "No matching games"}
                  classNamePrefix="select"
                />
              )}
            />
            {errors.gameId && (
              <p className="mt-1 text-sm text-red-500">{errors.gameId.message}</p>
            )}
          </div>
          
          {/* 反馈类型 - 使用react-select */}
          <div>
            <label htmlFor="feedbackType" className="block text-sm font-medium text-gray-700 mb-1">
              Feedback Type <span className="text-red-500">*</span>
            </label>
            <Controller
              name="feedbackType"
              control={control}
              rules={{ required: 'Please select a feedback type' }}
              render={({ field }) => (
                <Select
                  inputId="feedbackType"
                  options={feedbackTypeOptions}
                  placeholder="-- Select feedback type --"
                  isClearable={false}
                  isSearchable={true}
                  styles={customSelectStyles}
                  value={feedbackTypeOptions.find(option => option.value === field.value)}
                  onChange={(option) => field.onChange(option?.value)}
                  noOptionsMessage={() => "No matching types"}
                  classNamePrefix="select"
                />
              )}
            />
            {errors.feedbackType && (
              <p className="mt-1 text-sm text-red-500">{errors.feedbackType.message}</p>
            )}
          </div>
          
          {/* 评分系统 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rating
            </label>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRatingChange(star)}
                  className="text-2xl focus:outline-none mr-1"
                  aria-label={`${star} stars`}
                >
                  <i 
                    className={`${star <= rating ? 'fas' : 'far'} fa-star text-yellow-400`}
                  ></i>
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-500">
                {rating}/5
              </span>
            </div>
          </div>
          
          {/* 反馈内容 */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
              Feedback Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              rows={4}
              className={`w-full px-4 py-2 border ${errors.message ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-primary-500 focus:border-primary-500`}
              placeholder="Please describe your feedback in detail..."
              {...register('message', { 
                required: 'Please enter your feedback',
                minLength: {
                  value: 10,
                  message: 'Feedback must be at least 10 characters'
                }
              })}
            ></textarea>
            {errors.message && (
              <p className="mt-1 text-sm text-red-500">{errors.message.message}</p>
            )}
          </div>
          
          {/* 错误信息显示 */}
          {submitStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <div className="flex">
                <i className="fas fa-exclamation-circle mr-2 mt-1"></i>
                <div>
                  <p className="font-medium">Submission Failed</p>
                  <p className="text-sm">{errorMessage || 'Please try again later or send an email directly to 1479333689@qq.com'}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* 提交按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-500 rounded-full text-white hover:bg-primary-600 transition-colors flex items-center justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Submitting...
                </>
              ) : 'Submit Feedback'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default FeedbackForm; 