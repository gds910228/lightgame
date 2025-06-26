import emailjs from '@emailjs/browser';

// 初始化Email.js
// 注意：在实际使用时，您需要替换为您的Email.js公共密钥
export const initEmailService = () => {
  // 在生产环境中使用您的实际公共密钥
  // 您可以在 https://dashboard.emailjs.com/admin/account 找到您的公共密钥
  // emailjs.init('YOUR_PUBLIC_KEY');
  
  // 由于我们直接在组件中使用emailjs.send，不需要在这里初始化
  // 这样可以避免"Public Key is invalid"错误
};

// 发送反馈邮件
export const sendFeedbackEmail = async (templateParams: any) => {
  try {
    // 在实际使用时，您需要替换为您的Email.js服务ID和模板ID
    const response = await emailjs.send(
      'YOUR_SERVICE_ID',  // 替换为您的服务ID
      'YOUR_TEMPLATE_ID', // 替换为您的模板ID
      templateParams,
      'YOUR_PUBLIC_KEY'   // 替换为您的公共密钥
    );
    
    return {
      success: true,
      data: response
    };
  } catch (error) {
    console.error('发送邮件失败:', error);
    return {
      success: false,
      error
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
   - {{to_email}} - 接收邮件的邮箱
4. 获取您的公共密钥、服务ID和模板ID
   - 公共密钥: https://dashboard.emailjs.com/admin/account
   - 服务ID: https://dashboard.emailjs.com/admin
   - 模板ID: https://dashboard.emailjs.com/admin/templates
5. 替换此文件中的对应值
*/ 