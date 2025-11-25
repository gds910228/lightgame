/**
 * Created by Administrator on 2014/8/19.
 */

// Mock _hmt object for analytics (prevents errors when not defined)
if (typeof _hmt === 'undefined') {
    var _hmt = [];
}

var GameOverLayer = cc.Layer.extend
({
    target:null,
    menu:null,
    setCallback:function(target){
        this.target = target;
    },
    textLable:null,
    setText:function(text){
        if(!this.textLable){
             this.textLable = cc.LabelTTF.create(text,"微软雅黑",15);
            this.textLable.setColor(cc.c3b(0,0,0));
             this.textLable.setPosition(this.winSize.width/2,this.winSize.height/2-9);
           this.addChild(this.textLable);
       }else{
          this.textLable.setString(text);
      }
    },
    ctor:function () {
        this._super();
        if( 'touches' in sys.capabilities ){
            this.setTouchEnabled(true);
        }
        else if ('mouse' in sys.capabilities )
            this.setMouseEnabled(true);

    },
    onEnter:function()
    {

        cc.registerTargetedDelegate(-126, true, this);
        this._super();
    },
    onExit:function(){
        cc.unregisterTouchDelegate(this);
        this._super();
    },
    init:function() {
        this._super();
        this.winSize = cc.Director.getInstance().getWinSize();
        var dialog = cc.Sprite.create(res_dialog_bg);
        dialog.setPosition(this.winSize.width/2,this.winSize.height/2);
        this.addChild(dialog);
        var head2 = cc.Sprite.create(head2Src);
        head2.setPosition(this.winSize.width/2+75,this.winSize.height/2+50);
        this.addChild(head2);
        var $this = this;
        var agin = cc.MenuItemImage.create(res_agin_btn,res_agin_btn,function(){
              $this.target.aginGame();
        });
        agin.setPosition(-90,-50);
        var more = cc.MenuItemImage.create(res_more_btn,res_more_btn,function(){
            try {
                _hmt.push(['_trackEvent', 'escape', 'click', 'more', '1']);
            } catch(e) {}
            window.location.href = "/";
        });
        more.setPosition(0,-50);


        var share = cc.MenuItemImage.create(res_share_btn,res_share_btn,function(){
            try {
                _hmt.push(['_trackEvent', 'escape', 'click', 'share', '1']);
            } catch(e) {}
            // Send message to parent window to trigger project share functionality
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'SHARE_GAME',
                    data: {}
                }, '*');
            } else {
                // Fallback: try to use global share function if available
                if (typeof window.handleGlobalShare === 'function') {
                    window.handleGlobalShare();
                }
            }
        });
        share.setPosition(90,-50);

        this.menu = cc.Menu.create(agin,more,share);
        this.menu.setTouchPriority(-126);
        this.addChild( this.menu);

        return true;
    },

    onTouchBegan:function (touch, event) {
        return true;
    },
    onTouchMoved:function (touch, event) {
    },
    onTouchEnded:function (touch, event) {
    }
});

GameOverLayer.create = function (time,text,word) {
    var sg = new GameOverLayer();
    if (sg && sg.init())
    {
        sg.setText( "这次坚持了"+time.toFixed(2)+"秒，击败了全国"+text+"%的\n人，算是"+word+"了");

        return sg;
    }
    return  null;
};