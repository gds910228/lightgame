function load_page_1(){$("#c1").css("display","block");$("#c2").css("display","block");$("#c2").addClass("imgElementClick");$("#c3").css("display","block");$("#c4").css("display","block")}function load_page_2(){$("#c1").css("display","block");$("#c2").css("display","none");$("#c3").css("display","none");$("#c4").css("display","none");$("#c29").css("display","block");$("#c29").addClass("imgElementClick");$("#c18").addClass("imgElementClick");$("#c19").addClass("imgElementClick");$("#c30").css("display","block");$("#c21").css("display","block");$("#c25").css("display","block");$("#c13").css("display","block");$("#c14").css("display","block");$("#c14_").css("display","block");$("#c16").css("display","block");$("#c17").css("display","block");$("#c5").css("display","block");$("#c6").css("display","block")}var baozi_max=50;var eat_max_time=15;var first_eat=true;var finish_eat=false;var eat_count=0;var anim_count=0;var animArr_1=["#c28","#c26","#c27","#c26","#c27"];var animArr_2=["#c34","#c31","#c32","#c33","#c35"];var animArr_3=["#c35m","#c34m","#c31m","#c32m","#c33m"];function tmpFn(){if(anim_count>4){anim_count=0}if(anim_count==2||anim_count==4){eat_count++;$("#c14_").html("x "+eat_count)}if(eat_count>baozi_max*0.33&&eat_count<baozi_max*0.66){$("#c6").css("display","none");$("#c7").css("display","block")}else{if(eat_count>baozi_max*0.66){$("#c7").css("display","none");$("#c8").css("display","block")}}animArr_1.forEach(function(a){$(a).css("display","none")});$(animArr_1[anim_count]).css("display","block");animArr_2.forEach(function(a){$(a).css("display","none")});$(animArr_2[anim_count]).css("display","block");animArr_3.forEach(function(a){$(a).css("display","none")});$(animArr_3[anim_count]).css("display","block");anim_count++}function winORlose(){if(finish_eat==true){return}else{finish_eat=true}$("#c29").css("display","none");$("#c10").css("display","block");animArr_1.forEach(function(a){$(a).css("display","none")});animArr_2.forEach(function(a){$(a).css("display","none")});animArr_3.forEach(function(a){$(a).css("display","none")});if(eat_count<=20){$("#c22").css("display","block")}else{if(eat_count>20&&eat_count<=40){$("#c23").css("display","block")}else{if(eat_count>40){$("#c24").css("display","block")}}}setTimeout(function(){$("#c10").css("display","none");// Remove #c11 and #c36 from display - these are the top right corner elements
$("#c12").css("display","block");$("#c18").css("display","block");$("#c19").css("display","block");$("#c20").css("display","block");// Add share button with better positioning and styling - place it below the main buttons
setTimeout(function(){
$("#container").append('<div id="shareBtn" style="position:absolute;bottom:15%;left:50%;transform:translateX(-50%);background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:12px 24px;border-radius:25px;cursor:pointer;font-size:16px;font-weight:bold;z-index:1000;box-shadow:0 4px 15px rgba(0,0,0,0.2);border:2px solid rgba(255,255,255,0.3);transition:all 0.3s ease;">🔗 Share</div>');
}, 500);if(eat_count<=20){chat=eat_count+" buns is not enough! Bun Eater must be awesome!!";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 5% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}else{if(eat_count<=35){chat="Oh my! You only ate "+eat_count+" buns, keep practicing!";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 15% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}else{if(eat_count<=50){chat="Not bad! You ate "+eat_count+" buns in one go. Don't forget to drink some soup!";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 25% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}else{if(eat_count<=65){chat="Incredible! You ate "+eat_count+" buns! Be brave, eat more!";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 35% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}else{if(eat_count<=80){chat="You ate "+eat_count+" buns. Looks like you can't stop! Keep going!";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 45% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}else{if(eat_count<=95){chat="You ate "+eat_count+" buns. At this speed, you're a standard foodie!";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 55% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}else{if(eat_count<=110){chat="You ate "+eat_count+" buns. You have extraordinary talent for eating!";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 65% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}else{if(eat_count<=125){chat="Oh my! You ate "+eat_count+" buns... What can I say? Remember to take medicine...";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 75% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}else{if(eat_count<=140){chat="You ate "+eat_count+" buns. Such speed is godlike!";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 85% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}else{chat="Wow! You actually ate "+eat_count+" buns. You're like a god of eating!";share="I ate "+eat_count+" buns in the Bun Eating Contest and beat 95% of players!";share_imgUrl="/images/thumbnails/baozi.svg"}}}}}}}}}$("#c20").html(chat)},2000)}var chat="";$(document).on("click touchstart","#c2",function(a){a.preventDefault();a.stopPropagation();load_page_2()});$(document).on("click touchstart","#c29",function(a){a.preventDefault();a.stopPropagation();if(first_eat==true){$("#c17").animate({width:0},eat_max_time*1000,winORlose);first_eat=false}$("#c25").css("display","none");tmpFn()});$(document).on("click touchstart","#c18",function(a){a.preventDefault();a.stopPropagation();$("#container").html("");window.location.reload()});$(document).on("click touchstart","#c19",function(a){a.preventDefault();a.stopPropagation();window.location.href="/";});

// Add share button click handler with hover effect
$(document).on("mouseenter","#shareBtn",function(){
    $(this).css({
        "transform": "translateX(-50%) scale(1.05)",
        "box-shadow": "0 6px 20px rgba(0,0,0,0.3)"
    });
});

$(document).on("mouseleave","#shareBtn",function(){
    $(this).css({
        "transform": "translateX(-50%) scale(1)",
        "box-shadow": "0 4px 15px rgba(0,0,0,0.2)"
    });
});

$(document).on("click touchstart","#shareBtn",function(a){
    a.preventDefault();
    a.stopPropagation();
    // Add click animation
    $(this).css("transform", "translateX(-50%) scale(0.95)");
    setTimeout(() => {
        $(this).css("transform", "translateX(-50%) scale(1)");
    }, 150);
    shareToParent();
});

// Share function that communicates with parent window
function shareToParent() {
    console.log('shareToParent called with score:', eat_count);
    
    // Prevent any default behavior
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Try to call parent window's share functionality
    if (window.parent && window.parent !== window) {
        try {
            console.log('Sending message to parent window');
            // Send share request to parent window via postMessage with English text
            window.parent.postMessage({
                type: 'SHARE_GAME',
                data: {
                    score: eat_count,
                    gameTitle: 'Bun Eating Contest',
                    message: 'I ate ' + eat_count + ' buns in the Bun Eating Contest! Can you beat me?'
                }
            }, '*');
            console.log('Message sent successfully');
        } catch (e) {
            console.error('Failed to communicate with parent window:', e);
            // Fallback: copy link to clipboard
            fallbackShare();
        }
    } else {
        console.log('Not in iframe, using fallback share');
        // If not in iframe, use fallback share
        fallbackShare();
    }
    
    return false; // Prevent any further event handling
}

function fallbackShare() {
    try {
        const shareText = 'I ate ' + eat_count + ' buns in the Bun Eating Contest! Can you beat me? ' + window.location.href;
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Share link copied to clipboard!');
        }).catch(() => {
            alert('Share function not available');
        });
    } catch (e) {
        alert('Share function not available');
    }
}

$(function(){});var shareUrl=window.location.origin,shareTitle="Bun Eating Contest - Can you beat me?",share="Bun Eating Contest - Can you beat me?",share_imgUrl="/images/thumbnails/baozi.svg";

// Remove old WeChat sharing code - replaced with new share functionality above