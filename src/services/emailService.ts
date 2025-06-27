import emailjs from '@emailjs/browser';

// 获取环境变量，如果不存在则使用备用值
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'BvwywpSzR4WiypEws';
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_0awyadg';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_vn7scif';

// 初始化Email.js
export const initEmailService = () => {
  // 使用环境变量初始化EmailJS
  emailjs.init(PUBLIC_KEY);
  console.log('EmailJS已初始化');
  
  // 调试环境变量
  console.log('环境变量检查:');
  console.log('- PUBLIC_KEY:', PUBLIC_KEY);
  console.log('- SERVICE_ID:', SERVICE_ID);
  console.log('- TEMPLATE_ID:', TEMPLATE_ID);
};

// 发送反馈邮件
export const sendFeedbackEmail = async (templateParams: any) => {
  try {
    console.log('准备发送邮件:');
    console.log('- 使用服务:', SERVICE_ID);
    console.log('- 使用模板:', TEMPLATE_ID);
    console.log('- 发送参数:', templateParams);
    
    // 使用环境变量发送邮件
    const response = await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      templateParams,
      PUBLIC_KEY
    );
    
    console.log('邮件发送成功:', response);
    return {
      success: true,
      data: response
    };
  } catch (error) {
    console.error('发送邮件失败:', error);
    // 提供更详细的错误信息
    let errorMessage = '未知错误';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return {
      success: false,
      error,
      errorMessage
    };
  }
};

/*
使用说明:

1. 创建Email.js账号 (https://www.emailjs.com/)
2. 创建一个新的服务连接（如Gmail）
3. 创建一个邮件模板，包含以下变量:
   - {{from_name}} - 用户名
   - {{from_email}} - 用户邮箱
   - {{game}} - 游戏名称
   - {{feedback_type}} - 反馈类型
   - {{message}} - 反馈内容
   - {{email}} - 接收邮件的邮箱
4. 获取您的公共密钥、服务ID和模板ID，并添加到.env文件中:
   - VITE_EMAILJS_PUBLIC_KEY=您的公共密钥
   - VITE_EMAILJS_SERVICE_ID=您的服务ID
   - VITE_EMAILJS_TEMPLATE_ID=您的模板ID
*/ 