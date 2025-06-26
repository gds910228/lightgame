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
}

interface FeedbackFormProps {
  games: Game[];
  onClose: () => void;
}

// 反馈类型选项
const feedbackTypeOptions = [
  { value: 'bug', label: '问题报告' },
  { value: 'suggestion', label: '建议' },
  { value: 'other', label: '其他' }
];

const FeedbackForm = ({ games, onClose }: FeedbackFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const { 
    register, 
    handleSubmit,
    control,
    formState: { errors },
    reset
  } = useForm<FeedbackFormData>();

  // 将游戏列表转换为Select组件需要的格式
  const gameOptions = [
    { value: 'website', label: '网站整体' },
    ...games.map(game => ({
      value: game.id,
      label: game.title
    }))
  ];

  const onSubmit = async (data: FeedbackFormData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    
    try {
      // 找到选择的游戏名称
      const selectedGame = games.find(game => game.id === data.gameId);
      const gameTitle = selectedGame ? selectedGame.title : '网站整体';
      
      // 准备要发送的数据
      const templateParams = {
        from_name: data.name || '匿名用户',
        from_email: data.email,
        game: gameTitle,
        feedback_type: data.feedbackType === 'bug' ? '问题报告' : 
                     data.feedbackType === 'suggestion' ? '建议' : '其他',
        message: data.message,
        to_email: '1479333689@qq.com'
      };
      
      // 发送邮件
      const result = await sendFeedbackEmail(templateParams);
      
      if (result.success) {
        setSubmitStatus('success');
        reset(); // 重置表单
        
        // 成功后3秒关闭表单
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('发送反馈失败:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <h2 className="text-2xl font-bold text-gray-800">游戏反馈</h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          aria-label="关闭"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>
      
      {submitStatus === 'success' ? (
        <div className="text-center py-8">
          <div className="text-green-500 text-5xl mb-4">
            <i className="fas fa-check-circle"></i>
          </div>
          <h3 className="text-xl font-bold mb-2">反馈已提交</h3>
          <p className="text-gray-600 mb-4">感谢您的反馈！我们会尽快处理。</p>
          <button
            onClick={onClose}
            className="bg-primary-500 text-white px-6 py-2 rounded-full hover:bg-primary-600 transition-colors"
          >
            关闭
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 姓名字段 */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              姓名 (可选)
            </label>
            <input
              id="name"
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="您的姓名"
              {...register('name')}
            />
          </div>
          
          {/* 邮箱字段 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              邮箱 <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              className={`w-full px-4 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-primary-500 focus:border-primary-500`}
              placeholder="您的邮箱地址"
              {...register('email', { 
                required: '请输入邮箱地址',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: '请输入有效的邮箱地址'
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
              选择游戏 <span className="text-red-500">*</span>
            </label>
            <Controller
              name="gameId"
              control={control}
              rules={{ required: '请选择一个游戏' }}
              render={({ field }) => (
                <Select
                  inputId="gameId"
                  options={gameOptions}
                  placeholder="-- 请选择游戏 --"
                  isClearable={false}
                  isSearchable={true}
                  styles={customSelectStyles}
                  value={gameOptions.find(option => option.value === field.value)}
                  onChange={(option) => field.onChange(option?.value)}
                  noOptionsMessage={() => "没有匹配的游戏"}
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
              反馈类型 <span className="text-red-500">*</span>
            </label>
            <Controller
              name="feedbackType"
              control={control}
              rules={{ required: '请选择反馈类型' }}
              render={({ field }) => (
                <Select
                  inputId="feedbackType"
                  options={feedbackTypeOptions}
                  placeholder="-- 请选择反馈类型 --"
                  isClearable={false}
                  isSearchable={true}
                  styles={customSelectStyles}
                  value={feedbackTypeOptions.find(option => option.value === field.value)}
                  onChange={(option) => field.onChange(option?.value)}
                  noOptionsMessage={() => "没有匹配的类型"}
                  classNamePrefix="select"
                />
              )}
            />
            {errors.feedbackType && (
              <p className="mt-1 text-sm text-red-500">{errors.feedbackType.message}</p>
            )}
          </div>
          
          {/* 反馈内容 */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
              反馈内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              rows={4}
              className={`w-full px-4 py-2 border ${errors.message ? 'border-red-500' : 'border-gray-300'} rounded-md focus:ring-primary-500 focus:border-primary-500`}
              placeholder="请详细描述您的反馈内容..."
              {...register('message', { 
                required: '请输入反馈内容',
                minLength: {
                  value: 10,
                  message: '反馈内容至少需要10个字符'
                }
              })}
            ></textarea>
            {errors.message && (
              <p className="mt-1 text-sm text-red-500">{errors.message.message}</p>
            )}
          </div>
          
          {/* 提交按钮 */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-4 px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition-colors flex items-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-circle-notch fa-spin mr-2"></i>
                  提交中...
                </>
              ) : '提交反馈'}
            </button>
          </div>
          
          {/* 错误提示 */}
          {submitStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              <p className="flex items-center">
                <i className="fas fa-exclamation-circle mr-2"></i>
                提交失败，请稍后再试或直接发送邮件至1479333689@qq.com
              </p>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default FeedbackForm; 