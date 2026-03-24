// ═══ MERIDIAN UI — Interface Components Module ═══
// Theme, glossary, workflows, onboarding, modals, home page

// ═══ HOME PAGE ═══
function _getRecentActivity(){
  return JSON.parse(localStorage.getItem('meridian_activity')||'[]');
}
function _pushActivity(type,title,data){
  const items=_getRecentActivity();
  items.unshift({type,title,data,timestamp:new Date().toISOString()});
  // deduplicate by type+title, keep max 20
  const seen=new Set();
  const deduped=items.filter(i=>{const k=i.type+':'+i.title;if(seen.has(k))return false;seen.add(k);return true}).slice(0,20);
  localStorage.setItem('meridian_activity',JSON.stringify(deduped));
}
window._pushActivity=_pushActivity;

function _escH(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function _timeAgo(iso){
  const d=Date.now()-new Date(iso).getTime();
  if(d<60000)return 'just now';
  if(d<3600000)return Math.floor(d/60000)+'m ago';
  if(d<86400000)return Math.floor(d/3600000)+'h ago';
  if(d<604800000)return Math.floor(d/86400000)+'d ago';
  return new Date(iso).toLocaleDateString();
}

async function initHome(){
  const el=$('#home-content');if(!el)return;
  const user=typeof _getAuthUser==='function'?await _getAuthUser():window._supaUser;
  const signedIn=!!user;

  // Welcome banner
  let welcomeHtml;
  if(signedIn){
    let displayName=user.email;
    let affiliation='';
    try{
      const{data:prof}=await SB.from('user_profiles').select('display_name,affiliation').eq('user_id',user.id).maybeSingle();
      if(prof?.display_name)displayName=prof.display_name;
      if(prof?.affiliation)affiliation=prof.affiliation;
    }catch(e){}
    welcomeHtml=`<div class="home-welcome"><h2>Welcome back, ${_escH(displayName)}</h2>${affiliation?'<div class="home-affil">'+_escH(affiliation)+'</div>':''}<p class="home-sub">What are you working on today?</p></div>`;
  }else{
    welcomeHtml=`<div class="home-welcome"><div class="home-title">Meridian Engine</div><p class="home-sub">Open Research Platform for Marine &amp; Environmental Science</p><div class="home-guest-actions"><button class="bt bt-pri" onclick="showAuthModal()">Sign In</button><span class="home-view-all" onclick="goTab('lit')">Browse as Guest</span></div></div>`;
  }

  // Getting started for new users
  let gettingStarted='';
  const isNewUser=!S.lib?.length&&!S.litR?.length;
  if(isNewUser){
    gettingStarted=`<div style="padding:20px;background:var(--bs);border:1px solid var(--bd);border-radius:var(--rd);margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)"><h3 style="font-size:16px;font-weight:600;color:var(--ts);margin-bottom:6px">Welcome to Meridian</h3><p style="font-size:14px;color:var(--tm);line-height:1.6;margin-bottom:12px">Start by searching academic databases, or explore species and environmental data.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bt bt-pri" onclick="goTab('lit')">Search Literature</button><button class="bt bt-sec" onclick="goTab('species')">Explore Species</button><button class="bt bt-sec" onclick="goTab('env')">Environmental Data</button></div></div>`;
  }
  // Quick actions
  const qaHtml=`<div class="home-qa">
<div class="home-qa-card" style="border-top-color:var(--ac)" onclick="goTab('lit')"><span class="qa-icon" style="color:var(--ac)">&#x25C9;</span><h4>Search Literature</h4><p>4 databases simultaneously</p></div>
<div class="home-qa-card" style="border-top-color:var(--sg)" onclick="goTab('species')"><span class="qa-icon" style="color:var(--sg)">&#x27E1;</span><h4>Explore Species</h4><p>WoRMS · GBIF · OBIS · FishBase</p></div>
<div class="home-qa-card" style="border-top-color:var(--lv)" onclick="goTab('env')"><span class="qa-icon" style="color:var(--lv)">&#x25C8;</span><h4>Environmental Data</h4><p>SST · Chlorophyll · Salinity · 20+ variables</p></div>
<div class="home-qa-card" style="border-top-color:var(--wa)" onclick="${signedIn?"goTab('publications')":"showAuthModal()"}"><span class="qa-icon" style="color:var(--wa)">&#x1F4C4;</span><h4>Submit Publication</h4><p>Share your research with the community</p></div>
</div>`;

  // Recent activity (signed-in only, from localStorage)
  let activityHtml='';
  if(signedIn){
    const items=_getRecentActivity().slice(0,5);
    if(items.length){
      const icons={paper:'&#x1F4D6;',species:'&#x1F41F;',env:'&#x1F30A;',publication:'&#x1F4C4;',dataset:'&#x1F4BE;'};
      const rows=items.map(i=>{
        const icon=icons[i.type]||'&#x25CF;';
        return `<div class="home-activity-item" onclick="_activityClick('${_escH(i.type)}',${JSON.stringify(JSON.stringify(i.data))})"><span class="ha-icon">${icon}</span><div class="ha-body"><div class="ha-title">${_escH(i.title)}</div><div class="ha-meta">${_timeAgo(i.timestamp)}</div></div></div>`;
      }).join('');
      activityHtml=`<div class="home-section"><h3>Recent Activity</h3>${rows}</div>`;
    }else{
      activityHtml=`<div class="home-section"><h3>Recent Activity</h3><div class="home-comm-empty">No recent activity — start by searching for a paper or species</div></div>`;
    }
  }

  // Community sections + stats (async, render placeholders first)
  const communityId='home-community-'+Date.now();
  const statsId='home-stats-'+Date.now();
  const communityHtml=`<div class="home-section"><h3>Latest from the Community</h3><div class="home-community" id="${communityId}"><div><h3 style="font-size:13px;font-weight:600;color:var(--ts);margin-bottom:12px">Latest Publications</h3><div class="home-comm-empty">Loading…</div></div><div><h3 style="font-size:13px;font-weight:600;color:var(--ts);margin-bottom:12px">Latest Datasets</h3><div class="home-comm-empty">Loading…</div></div></div></div>`;
  const statsHtml=`<div class="home-stats" id="${statsId}"><div class="home-stat"><div class="hs-num">—</div><div class="hs-label">Papers Searchable</div></div><div class="home-stat"><div class="hs-num">—</div><div class="hs-label">Publications Submitted</div></div><div class="home-stat"><div class="hs-num">—</div><div class="hs-label">Datasets Archived</div></div><div class="home-stat"><div class="hs-num">—</div><div class="hs-label">Registered Researchers</div></div></div>`;

  el.innerHTML=welcomeHtml+gettingStarted+qaHtml+activityHtml+communityHtml+statsHtml;

  // Load community data async
  _loadCommunityData(communityId,statsId);
}

function _activityClick(type,dataStr){
  try{const d=JSON.parse(dataStr);
    if(type==='paper'){goTab('library')}
    else if(type==='species'){$('#sq').value=d?.name||'';goTab('species')}
    else if(type==='env'){goTab('env')}
    else if(type==='publication'){goTab('publications')}
    else if(type==='dataset'){goTab('archive')}
    else goTab('lit');
  }catch(e){goTab('lit')}
}

async function _loadCommunityData(commId,statsId){
  const commEl=$('#'+commId);
  const statsEl=$('#'+statsId);
  if(!window.SB)return;

  // Publications
  let pubsHtml='';
  try{
    const{data:pubs}=await SB.from('publications').select('id,meridian_id,title,authors,category,created_at').eq('status','published').order('created_at',{ascending:false}).limit(5);
    if(pubs&&pubs.length){
      pubsHtml=pubs.map(p=>`<div class="home-comm-card" onclick="goTab('publications')"><h5>${_escH(p.title)}</h5><div class="hcc-meta"><span>${_escH(p.meridian_id||'')}</span><span class="bg oa" style="font-size:9px;padding:1px 6px;margin:0">${_escH(p.category||'Research')}</span><span>${p.authors?_escH(Array.isArray(p.authors)?p.authors.slice(0,2).join(', '):String(p.authors).slice(0,40)):''}</span><span>${new Date(p.created_at).toLocaleDateString()}</span></div></div>`).join('');
    }else{
      pubsHtml='<div class="home-comm-empty">No publications yet — be the first to share your research</div>';
    }
  }catch(e){pubsHtml='<div class="home-comm-empty">Could not load publications</div>'}

  // Datasets
  let datasetsHtml='';
  try{
    const{data:ds}=await SB.from('archived_datasets').select('id,meridian_data_id,title,data_type,file_format,download_count,created_at').eq('status','published').order('created_at',{ascending:false}).limit(5);
    if(ds&&ds.length){
      datasetsHtml=ds.map(d=>`<div class="home-comm-card" onclick="goTab('archive')"><h5>${_escH(d.title)}</h5><div class="hcc-meta"><span>${_escH(d.meridian_data_id||'')}</span><span class="bg oa" style="font-size:9px;padding:1px 6px;margin:0">${_escH(d.data_type||'Data')}</span><span>${_escH(d.file_format||'')}</span>${d.download_count?'<span>'+d.download_count+' downloads</span>':''}<span>${new Date(d.created_at).toLocaleDateString()}</span></div></div>`).join('');
    }else{
      datasetsHtml='<div class="home-comm-empty">No datasets yet — contribute your data</div>';
    }
  }catch(e){datasetsHtml='<div class="home-comm-empty">Could not load datasets</div>'}

  if(commEl){
    commEl.innerHTML=`<div><h3 style="font-size:13px;font-weight:600;color:var(--ts);margin-bottom:12px">Latest Publications</h3>${pubsHtml}<div style="margin-top:8px"><span class="home-view-all" onclick="goTab('publications')">View All Publications →</span></div></div><div><h3 style="font-size:13px;font-weight:600;color:var(--ts);margin-bottom:12px">Latest Datasets</h3>${datasetsHtml}<div style="margin-top:8px"><span class="home-view-all" onclick="goTab('archive')">View All Datasets →</span></div></div>`;
  }

  // Stats
  if(!statsEl)return;
  let pubCount=0,dsCount=0,userCount=0;
  try{const{count}=await SB.from('publications').select('id',{count:'exact',head:true}).eq('status','published');pubCount=count||0}catch(e){}
  try{const{count}=await SB.from('archived_datasets').select('id',{count:'exact',head:true}).eq('status','published');dsCount=count||0}catch(e){}
  try{const{count}=await SB.from('user_profiles').select('id',{count:'exact',head:true});userCount=count||0}catch(e){}
  const papersSearchable='250M+';// OpenAlex total
  const cells=statsEl.querySelectorAll('.home-stat');
  if(cells[0])cells[0].querySelector('.hs-num').textContent=papersSearchable;
  if(cells[1])cells[1].querySelector('.hs-num').textContent=pubCount.toLocaleString();
  if(cells[2])cells[2].querySelector('.hs-num').textContent=dsCount.toLocaleString();
  if(cells[3])cells[3].querySelector('.hs-num').textContent=userCount.toLocaleString();
}

// Fire initHome on first load
(function(){setTimeout(()=>{if(typeof initHome==='function'&&$('#tab-home.on'))initHome()},200)})();

// ═══ DAILY QUOTE ═══
const _QUOTES=[
// Scientists
["The important thing is not to stop questioning. Curiosity has its own reason for existing.","Albert Einstein"],
["Imagination is more important than knowledge. Knowledge is limited. Imagination encircles the world.","Albert Einstein"],
["Life is like riding a bicycle. To keep your balance, you must keep moving.","Albert Einstein"],
["The measure of intelligence is the ability to change.","Albert Einstein"],
["I have no special talents. I am only passionately curious.","Albert Einstein"],
["Look deep into nature, and then you will understand everything better.","Albert Einstein"],
["Strive not to be a success, but rather to be of value.","Albert Einstein"],
["The only source of knowledge is experience.","Albert Einstein"],
["Nothing in life is to be feared, it is only to be understood.","Marie Curie"],
["Be less curious about people and more curious about ideas.","Marie Curie"],
["One never notices what has been done; one can only see what remains to be done.","Marie Curie"],
["I was taught that the way of progress was neither swift nor easy.","Marie Curie"],
["The sea, once it casts its spell, holds one in its net of wonder forever.","Jacques Cousteau"],
["The best way to observe a fish is to become a fish.","Jacques Cousteau"],
["People protect what they love.","Jacques Cousteau"],
["From birth, man carries the weight of gravity on his shoulders. But he has only to sink beneath the surface and he is free.","Jacques Cousteau"],
["The ocean is everything I want to be. Beautiful, mysterious, wild, and free.","Sylvia Earle"],
["No water, no life. No blue, no green.","Sylvia Earle"],
["The best scientists and explorers have the attributes of kids.","Sylvia Earle"],
["Far better is it to dare mighty things than to rank with those who neither enjoy much nor suffer much.","Sylvia Earle"],
["Every great advance in science has issued from a new audacity of imagination.","Sylvia Earle"],
["Somewhere, something incredible is waiting to be known.","Carl Sagan"],
["The cosmos is within us. We are made of star-stuff.","Carl Sagan"],
["For small creatures such as we, the vastness is bearable only through love.","Carl Sagan"],
["Understanding is a kind of ecstasy.","Carl Sagan"],
["Science is a way of thinking much more than it is a body of knowledge.","Carl Sagan"],
["We are a way for the cosmos to know itself.","Carl Sagan"],
["Extinction is the rule. Survival is the exception.","Carl Sagan"],
["There is grandeur in this view of life.","Charles Darwin"],
["It is not the strongest of the species that survives, but the most adaptable.","Charles Darwin"],
["A man who dares to waste one hour of time has not discovered the value of life.","Charles Darwin"],
["The love for all living creatures is the most noble attribute of man.","Charles Darwin"],
["In the long history of humankind, those who learned to collaborate most effectively have prevailed.","Charles Darwin"],
["The first principle is that you must not fool yourself — and you are the easiest person to fool.","Richard Feynman"],
["I would rather have questions that can't be answered than answers that can't be questioned.","Richard Feynman"],
["Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.","Richard Feynman"],
["Everything is interesting if you go into it deeply enough.","Richard Feynman"],
["The pleasure of finding things out is the most important thing in the world.","Richard Feynman"],
["Intelligence is the ability to adapt to change.","Stephen Hawking"],
["However difficult life may seem, there is always something you can do and succeed at.","Stephen Hawking"],
["The greatest enemy of knowledge is not ignorance, it is the illusion of knowledge.","Stephen Hawking"],
["Remember to look up at the stars and not down at your feet.","Stephen Hawking"],
["The universe doesn't allow perfection.","Stephen Hawking"],
["In every walk with nature one receives far more than he seeks.","Rachel Carson"],
["The more clearly we can focus our attention on the wonders of the universe, the less taste we shall have for destruction.","Rachel Carson"],
["Those who contemplate the beauty of the earth find reserves of strength that will endure as long as life lasts.","Rachel Carson"],
["If I have seen further, it is by standing upon the shoulders of giants.","Isaac Newton"],
["The present is theirs; the future, for which I really worked, is mine.","Nikola Tesla"],
["If you want to find the secrets of the universe, think in terms of energy, frequency and vibration.","Nikola Tesla"],
["Be alone, that is the secret of invention; be alone, that is when ideas are born.","Nikola Tesla"],
["Our virtues and our failings are inseparable, like force and matter.","Nikola Tesla"],
// Philosophers
["We suffer more in imagination than in reality.","Seneca"],
["Luck is what happens when preparation meets opportunity.","Seneca"],
["It is not that we have a short time to live, but that we waste a great deal of it.","Seneca"],
["Difficulties strengthen the mind, as labor does the body.","Seneca"],
["Begin at once to live, and count each separate day as a separate life.","Seneca"],
["While we are postponing, life speeds by.","Seneca"],
["He who is brave is free.","Seneca"],
["No man is free who is not master of himself.","Seneca"],
["As is a tale, so is life: not how long it is, but how good it is, that matters.","Seneca"],
["You have power over your mind — not outside events. Realize this, and you will find strength.","Marcus Aurelius"],
["The happiness of your life depends upon the quality of your thoughts.","Marcus Aurelius"],
["Waste no more time arguing about what a good man should be. Be one.","Marcus Aurelius"],
["The impediment to action advances action. What stands in the way becomes the way.","Marcus Aurelius"],
["Very little is needed to make a happy life; it is all within yourself.","Marcus Aurelius"],
["When you arise in the morning, think of what a privilege it is to be alive.","Marcus Aurelius"],
["The soul becomes dyed with the colour of its thoughts.","Marcus Aurelius"],
["Accept the things to which fate binds you, and love the people with whom fate brings you together.","Marcus Aurelius"],
["Knowing yourself is the beginning of all wisdom.","Aristotle"],
["We are what we repeatedly do. Excellence, then, is not an act, but a habit.","Aristotle"],
["It is the mark of an educated mind to entertain a thought without accepting it.","Aristotle"],
["The roots of education are bitter, but the fruit is sweet.","Aristotle"],
["Quality is not an act, it is a habit.","Aristotle"],
["The energy of the mind is the essence of life.","Aristotle"],
["A journey of a thousand miles begins with a single step.","Lao Tzu"],
["Nature does not hurry, yet everything is accomplished.","Lao Tzu"],
["The wise man is one who knows what he does not know.","Lao Tzu"],
["When I let go of what I am, I become what I might be.","Lao Tzu"],
["Be content with what you have; rejoice in the way things are.","Lao Tzu"],
["Mastering others is strength. Mastering yourself is true power.","Lao Tzu"],
["Silence is a source of great strength.","Lao Tzu"],
["It's not what happens to you, but how you react to it that matters.","Epictetus"],
["First say to yourself what you would be; and then do what you have to do.","Epictetus"],
["Only the educated are free.","Epictetus"],
["Make the best use of what is in your power, and take the rest as it happens.","Epictetus"],
["Man is not worried by real problems so much as by his imagined anxieties.","Epictetus"],
["Do not explain your philosophy. Embody it.","Epictetus"],
["What lies behind us and what lies before us are tiny matters compared to what lies within us.","Ralph Waldo Emerson"],
["The only person you are destined to become is the person you decide to be.","Ralph Waldo Emerson"],
["Do not go where the path may lead, go instead where there is no path and leave a trail.","Ralph Waldo Emerson"],
["Every artist was first an amateur.","Ralph Waldo Emerson"],
["To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.","Ralph Waldo Emerson"],
["The creation of a thousand forests is in one acorn.","Ralph Waldo Emerson"],
["Go confidently in the direction of your dreams. Live the life you have imagined.","Henry David Thoreau"],
["Not until we are lost do we begin to understand ourselves.","Henry David Thoreau"],
["Our life is frittered away by detail. Simplify, simplify.","Henry David Thoreau"],
["What you get by achieving your goals is not as important as what you become.","Henry David Thoreau"],
["In the middle of difficulty lies opportunity.","Albert Camus"],
["The only way to deal with an unfree world is to become so absolutely free that your very existence is an act of rebellion.","Albert Camus"],
["Man is the only creature who refuses to be what he is.","Albert Camus"],
["Live to the point of tears.","Albert Camus"],
["Don't walk behind me; I may not lead. Don't walk in front of me; I may not follow. Just walk beside me and be my friend.","Albert Camus"],
["Let yourself be silently drawn by the strange pull of what you really love.","Rumi"],
["The wound is the place where the Light enters you.","Rumi"],
["What you seek is seeking you.","Rumi"],
["Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.","Rumi"],
["Don't be satisfied with stories of how things have gone with others. Unfold your own myth.","Rumi"],
["You were born with wings, why prefer to crawl through life?","Rumi"],
["The only thing I know is that I know nothing.","Socrates"],
["The unexamined life is not worth living.","Socrates"],
["Education is the kindling of a flame, not the filling of a vessel.","Socrates"],
["Strong minds discuss ideas, average minds discuss events, weak minds discuss people.","Socrates"],
["Wonder is the beginning of wisdom.","Socrates"],
["No man has the right to be an amateur in the matter of physical training.","Socrates"],
["Courage is knowing what not to fear.","Plato"],
["Be kind, for everyone you meet is fighting a hard battle.","Plato"],
["Wise men speak because they have something to say; fools because they have to say something.","Plato"],
["The measure of a man is what he does with power.","Plato"],
["No one is more hated than he who speaks the truth.","Plato"],
["The only true wisdom is in knowing you know nothing.","Plato"],
["No man ever steps in the same river twice, for it's not the same river and he's not the same man.","Heraclitus"],
["The soul is dyed the color of its thoughts.","Heraclitus"],
["Day by day, what you choose, what you think and what you do is who you become.","Heraclitus"],
["Everything flows, nothing stands still.","Heraclitus"],
["It is in changing that things find purpose.","Heraclitus"],
["We have two ears and one tongue so that we would listen more and talk less.","Diogenes"],
["It is not that I am mad, it is only that my head is different from yours.","Diogenes"],
["The foundation of every state is the education of its youth.","Diogenes"],
["Do not spoil what you have by desiring what you have not.","Epicurus"],
["He who is not satisfied with a little is satisfied with nothing.","Epicurus"],
["Of all the things which wisdom provides for living one's entire life in happiness, the greatest is friendship.","Epicurus"],
["Not what we have but what we enjoy constitutes our abundance.","Epicurus"],
["Man conquers the world by conquering himself.","Zeno of Citium"],
["We have two ears and one mouth, so we should listen more than we say.","Zeno of Citium"],
["The goal of life is living in agreement with nature.","Zeno of Citium"],
["The past is a foreign country; they do things differently there.","Ibn Khaldun"],
["Geometry enlightens the intellect and sets one's mind right.","Ibn Khaldun"],
["Throughout history, many nations have suffered a physical defeat, but that has never marked the end of a nation.","Ibn Khaldun"],
["The world is a great book, of which they who never stir from home read only a page.","Ibn Khaldun"],
["Medicine deals with the states of health and disease in the human body.","Avicenna"],
["The knowledge of anything, since all things have causes, is not acquired or complete unless it is known by its causes.","Avicenna"],
["Width of life is more important than length of life.","Avicenna"],
["Knowledge is the conformity of the object and the intellect.","Averroes"],
["Ignorance leads to fear, fear leads to hatred, and hatred leads to violence.","Averroes"],
["There are many roads to truth, and each of us must find one that suits us.","Averroes"],
["The study of mathematics is the indispensable basis for all intellectual and spiritual progress.","Al-Khwarizmi"],
["A room without books is like a body without a soul.","Cicero"],
["The life of the dead is placed in the memory of the living.","Cicero"],
["If you have a garden and a library, you have everything you need.","Cicero"],
["Not for ourselves alone are we born.","Cicero"],
["Gratitude is not only the greatest of virtues, but the parent of all others.","Cicero"],
// Leaders
["Success is not final, failure is not fatal: it is the courage to continue that counts.","Winston Churchill"],
["We make a living by what we get, but we make a life by what we give.","Winston Churchill"],
["The pessimist sees difficulty in every opportunity. The optimist sees opportunity in every difficulty.","Winston Churchill"],
["To improve is to change; to be perfect is to change often.","Winston Churchill"],
["Courage is what it takes to stand up and speak; courage is also what it takes to sit down and listen.","Winston Churchill"],
["You will never reach your destination if you stop and throw stones at every dog that barks.","Winston Churchill"],
["Education is the most powerful weapon which you can use to change the world.","Nelson Mandela"],
["It always seems impossible until it's done.","Nelson Mandela"],
["Do not judge me by my successes, judge me by how many times I fell down and got back up again.","Nelson Mandela"],
["I learned that courage was not the absence of fear, but the triumph over it.","Nelson Mandela"],
["A winner is a dreamer who never gives up.","Nelson Mandela"],
["What counts in life is not the mere fact that we have lived.","Nelson Mandela"],
["Believe you can and you're halfway there.","Theodore Roosevelt"],
["Do what you can, with what you have, where you are.","Theodore Roosevelt"],
["It is hard to fail, but it is worse never to have tried to succeed.","Theodore Roosevelt"],
["In any moment of decision, the best thing you can do is the right thing.","Theodore Roosevelt"],
["The credit belongs to the man who is actually in the arena.","Theodore Roosevelt"],
["The best time to plant a tree was twenty years ago. The second best time is now.","Theodore Roosevelt"],
["In the end, it's not the years in your life that count. It's the life in your years.","Abraham Lincoln"],
["The best way to predict your future is to create it.","Abraham Lincoln"],
["I am a slow walker, but I never walk back.","Abraham Lincoln"],
["Whatever you are, be a good one.","Abraham Lincoln"],
["Give me six hours to chop down a tree and I will spend the first four sharpening the axe.","Abraham Lincoln"],
["Those who deny freedom to others deserve it not for themselves.","Abraham Lincoln"],
["Injustice anywhere is a threat to justice everywhere.","Martin Luther King Jr."],
["The time is always right to do what is right.","Martin Luther King Jr."],
["Darkness cannot drive out darkness; only light can do that.","Martin Luther King Jr."],
["Faith is taking the first step even when you don't see the whole staircase.","Martin Luther King Jr."],
["Our lives begin to end the day we become silent about things that matter.","Martin Luther King Jr."],
["If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but by all means keep moving.","Martin Luther King Jr."],
["The only thing we have to fear is fear itself.","Franklin D. Roosevelt"],
["Ask not what your country can do for you — ask what you can do for your country.","John F. Kennedy"],
["Change is the law of life. Those who look only to the past or present are certain to miss the future.","John F. Kennedy"],
["Efforts and courage are not enough without purpose and direction.","John F. Kennedy"],
["Be the change that you wish to see in the world.","Mahatma Gandhi"],
["Live as if you were to die tomorrow. Learn as if you were to live forever.","Mahatma Gandhi"],
["The future depends on what you do today.","Mahatma Gandhi"],
["Strength does not come from physical capacity. It comes from an indomitable will.","Mahatma Gandhi"],
["In a gentle way, you can shake the world.","Mahatma Gandhi"],
["An ounce of practice is worth more than tons of preaching.","Mahatma Gandhi"],
// Explorers
["The sea is dangerous and its storms terrible, but these obstacles have never been sufficient reason to remain ashore.","Ferdinand Magellan"],
["Difficulties are just things to overcome, after all.","Ernest Shackleton"],
["Optimism is true moral courage.","Ernest Shackleton"],
["By endurance we conquer.","Ernest Shackleton"],
["It is not the mountain we conquer, but ourselves.","Edmund Hillary"],
["Nobody climbs mountains for scientific reasons. You really climb for the hell of it.","Edmund Hillary"],
["That's one small step for man, one giant leap for mankind.","Neil Armstrong"],
["Mystery creates wonder, and wonder is the basis of man's desire to understand.","Neil Armstrong"],
["The most effective way to do it, is to do it.","Amelia Earhart"],
["Adventure is worthwhile in itself.","Amelia Earhart"],
["The most difficult thing is the decision to act, the rest is merely tenacity.","Amelia Earhart"],
["Never interrupt someone doing what you said couldn't be done.","Amelia Earhart"],
["If anything is worth doing, do it with all your heart.","Amelia Earhart"],
// Athletes
["Float like a butterfly, sting like a bee.","Muhammad Ali"],
["Don't count the days, make the days count.","Muhammad Ali"],
["He who is not courageous enough to take risks will accomplish nothing in life.","Muhammad Ali"],
["I hated every minute of training, but I said, don't quit. Suffer now and live the rest of your life as a champion.","Muhammad Ali"],
["Impossible is just a big word thrown around by small men.","Muhammad Ali"],
["It's the repetition of affirmations that leads to belief. And once that belief becomes a deep conviction, things begin to happen.","Muhammad Ali"],
["I've failed over and over and over again in my life. And that is why I succeed.","Michael Jordan"],
["I can accept failure, everyone fails at something. But I can't accept not trying.","Michael Jordan"],
["Some people want it to happen, some wish it would happen, others make it happen.","Michael Jordan"],
["Talent wins games, but teamwork and intelligence win championships.","Michael Jordan"],
["The best way to predict your future is to create it yourself.","Michael Jordan"],
["Everything negative — pressure, challenges — is all an opportunity for me to rise.","Kobe Bryant"],
["The most important thing is to try and inspire people so that they can be great at whatever they want to do.","Kobe Bryant"],
["I can't relate to lazy people. We don't speak the same language.","Kobe Bryant"],
["Once you know what failure feels like, determination chases success.","Kobe Bryant"],
["Be water, my friend.","Bruce Lee"],
["Absorb what is useful, discard what is useless and add what is specifically your own.","Bruce Lee"],
["Do not pray for an easy life, pray for the strength to endure a difficult one.","Bruce Lee"],
["Knowing is not enough, we must apply. Willing is not enough, we must do.","Bruce Lee"],
["The key to immortality is first living a life worth remembering.","Bruce Lee"],
["A wise man can learn more from a foolish question than a fool can learn from a wise answer.","Bruce Lee"],
["I'm not designed to finish second or third. I'm designed to win.","Ayrton Senna"],
["If you no longer go for a gap that exists, you are no longer a racing driver.","Ayrton Senna"],
["Being second is to be the first of the ones who lose.","Ayrton Senna"],
["Success is no accident. It is hard work, perseverance, learning, studying, sacrifice and most of all, love of what you are doing.","Pelé"],
["The more difficult the victory, the greater the happiness in winning.","Pelé"],
["Everything is practice.","Pelé"],
// Writers
["There is nothing noble in being superior to your fellow man; true nobility is being superior to your former self.","Ernest Hemingway"],
["The world breaks everyone, and afterward, many are strong at the broken places.","Ernest Hemingway"],
["Courage is grace under pressure.","Ernest Hemingway"],
["The best way to find out if you can trust somebody is to trust them.","Ernest Hemingway"],
["All you have to do is write one true sentence. Write the truest sentence that you know.","Ernest Hemingway"],
["The man who does not read has no advantage over the man who cannot read.","Mark Twain"],
["Whenever you find yourself on the side of the majority, it is time to pause and reflect.","Mark Twain"],
["Twenty years from now you will be more disappointed by the things you didn't do than by the ones you did do.","Mark Twain"],
["The secret of getting ahead is getting started.","Mark Twain"],
["Kindness is the language which the deaf can hear and the blind can see.","Mark Twain"],
["Truth is stranger than fiction, because fiction is obliged to stick to possibilities; truth isn't.","Mark Twain"],
["Continuous improvement is better than delayed perfection.","Mark Twain"],
["Not all those who wander are lost.","J.R.R. Tolkien"],
["All we have to decide is what to do with the time that is given us.","J.R.R. Tolkien"],
["Even the smallest person can change the course of the future.","J.R.R. Tolkien"],
["There is some good in this world, and it's worth fighting for.","J.R.R. Tolkien"],
["The world is indeed full of peril, and in it there are many dark places; but still there is much that is fair.","J.R.R. Tolkien"],
["It is not in the stars to hold our destiny but in ourselves.","William Shakespeare"],
["We know what we are, but know not what we may be.","William Shakespeare"],
["All that glitters is not gold.","William Shakespeare"],
["The fault, dear Brutus, is not in our stars, but in ourselves.","William Shakespeare"],
["To thine own self be true.","William Shakespeare"],
["What is essential is invisible to the eye.","Antoine de Saint-Exupéry"],
["Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.","Antoine de Saint-Exupéry"],
["If you want to build a ship, don't drum up people to collect wood — teach them to long for the immensity of the sea.","Antoine de Saint-Exupéry"],
["A designer knows he has achieved perfection not when there is nothing left to add, but nothing left to take away.","Antoine de Saint-Exupéry"],
["In a time of deceit, telling the truth is a revolutionary act.","George Orwell"],
["Who controls the past controls the future. Who controls the present controls the past.","George Orwell"],
["The soul is healed by being with children.","Fyodor Dostoevsky"],
["The mystery of human existence lies not in just staying alive, but in finding something to live for.","Fyodor Dostoevsky"],
["To live without hope is to cease to live.","Fyodor Dostoevsky"],
["Pain and suffering are always inevitable for a large intelligence and a deep heart.","Fyodor Dostoevsky"],
["What matters most is how well you walk through the fire.","Charles Bukowski"],
["Find what you love and let it kill you.","Charles Bukowski"],
["Sometimes you climb out of bed in the morning and you think, I'm not going to make it, but you laugh inside — remembering all the times you've felt that way.","Charles Bukowski"],
["And now that you don't have to be perfect, you can be good.","John Steinbeck"],
["A journey is like marriage. The certain way to be wrong is to think you control it.","John Steinbeck"],
["I wonder how many people I've looked at all my life and never seen.","John Steinbeck"],
["All great and precious things are lonely.","John Steinbeck"],
// Pioneers
["If we all worked on the assumption that what is accepted as true is really true, there would be little hope of advance.","Orville Wright"],
["If we worked on the assumption that what is accepted as true really is true, then there would be little hope for advance.","Wilbur Wright"],
["The desire to fly is an idea handed down to us by our ancestors.","Wilbur Wright"],
["The human spirit needs places where nature has not been rearranged by the hand of man.","Roger Bannister"],
["Failure is as much a part of life as success, and by no means something in front of which one sits down and howls.","Roger Bannister"],
["The man who has no inner life is a slave to his surroundings.","Henri-Frédéric Amiel"],
["It is by going down into the abyss that we recover the treasures of life.","Joseph Campbell"],
["The privilege of a lifetime is being who you are.","Joseph Campbell"],
["Follow your bliss and the universe will open doors for you where there were only walls.","Joseph Campbell"],
["Mountains are not stadiums where I satisfy my ambition to achieve, they are cathedrals where I practice my religion.","Reinhold Messner"],
["The summit is what drives us, but the climb itself is what matters.","Reinhold Messner"],
["I see Earth! It is so beautiful!","Yuri Gagarin"],
["Orbiting Earth, I am amazed at how beautiful our planet is. People, let us preserve and increase this beauty, not destroy it!","Yuri Gagarin"],
["To be the first to enter the cosmos, to engage, single-handed, in an unprecedented duel with nature — could one dream of anything more?","Yuri Gagarin"],
// Bonus mix for 365
["The best time to plant a tree was 20 years ago. The second best time is now.","Chinese Proverb"],
["The only limit to our realization of tomorrow will be our doubts of today.","Franklin D. Roosevelt"],
["Well done is better than well said.","Benjamin Franklin"],
["An investment in knowledge pays the best interest.","Benjamin Franklin"],
["Either write something worth reading or do something worth writing.","Benjamin Franklin"],
["Energy and persistence conquer all things.","Benjamin Franklin"],
["Tell me and I forget, teach me and I may remember, involve me and I learn.","Benjamin Franklin"],
["Try not to become a man of success. Rather become a man of value.","Albert Einstein"],
["Peace cannot be kept by force; it can only be achieved by understanding.","Albert Einstein"],
["The world as we have created it is a process of our thinking. It cannot be changed without changing our thinking.","Albert Einstein"],
["You must be the change you wish to see in the world.","Mahatma Gandhi"],
["The best revenge is massive success.","Frank Sinatra"],
["Turn your wounds into wisdom.","Oprah Winfrey"],
["It does not matter how slowly you go as long as you do not stop.","Confucius"],
["Our greatest glory is not in never falling, but in rising every time we fall.","Confucius"],
["Real knowledge is to know the extent of one's ignorance.","Confucius"],
["He who conquers himself is the mightiest warrior.","Confucius"],
["Everything has beauty, but not everyone sees it.","Confucius"],
["It is during our darkest moments that we must focus to see the light.","Aristotle"],
["We are what we pretend to be, so we must be careful about what we pretend to be.","Kurt Vonnegut"],
["The meaning of life is to find your gift. The purpose of life is to give it away.","Pablo Picasso"],
["Every child is an artist. The problem is how to remain an artist once we grow up.","Pablo Picasso"],
["Action is the foundational key to all success.","Pablo Picasso"],
["The purpose of our lives is to be happy.","Dalai Lama"],
["Happiness is not something ready-made. It comes from your own actions.","Dalai Lama"],
["If you think you are too small to make a difference, try sleeping with a mosquito.","Dalai Lama"],
["The discipline of desire is the background of character.","John Locke"],
["What we know is a drop, what we don't know is an ocean.","Isaac Newton"],
["If I have seen further, it is by standing on the shoulders of giants.","Isaac Newton"],
["Genius is one percent inspiration, ninety-nine percent perspiration.","Thomas Edison"],
["I have not failed. I've just found 10,000 ways that won't work.","Thomas Edison"],
["Our greatest weakness lies in giving up. The most certain way to succeed is always to try just one more time.","Thomas Edison"],
["There is no substitute for hard work.","Thomas Edison"],
["Opportunity is missed by most people because it is dressed in overalls and looks like work.","Thomas Edison"],
["Vision without execution is just hallucination.","Thomas Edison"],
["Stay hungry, stay foolish.","Steve Jobs"],
["Your time is limited, don't waste it living someone else's life.","Steve Jobs"],
["Innovation distinguishes between a leader and a follower.","Steve Jobs"],
["The only way to do great work is to love what you do.","Steve Jobs"],
["Have the courage to follow your heart and intuition.","Steve Jobs"],
["Here's to the crazy ones. The misfits. The rebels. The troublemakers.","Steve Jobs"],
["Simple can be harder than complex. You have to work hard to get your thinking clean to make it simple.","Steve Jobs"],
["I think, therefore I am.","René Descartes"],
["The reading of all good books is like a conversation with the finest minds of past centuries.","René Descartes"],
["He who would learn to fly one day must first learn to walk and run and climb and dance.","Friedrich Nietzsche"],
["That which does not kill us makes us stronger.","Friedrich Nietzsche"],
["Without music, life would be a mistake.","Friedrich Nietzsche"],
["One must still have chaos in oneself to give birth to a dancing star.","Friedrich Nietzsche"],
["There are no facts, only interpretations.","Friedrich Nietzsche"],
["The mind is everything. What you think you become.","Buddha"],
["Three things cannot be long hidden: the sun, the moon, and the truth.","Buddha"],
["In the end, only three things matter: how much you loved, how gently you lived, and how gracefully you let go.","Buddha"],
["You yourself, as much as anybody in the entire universe, deserve your love and affection.","Buddha"],
["Life isn't about finding yourself. Life is about creating yourself.","George Bernard Shaw"],
["Progress is impossible without change, and those who cannot change their minds cannot change anything.","George Bernard Shaw"],
["People who say it cannot be done should not interrupt those who are doing it.","George Bernard Shaw"],
["We don't stop playing because we grow old; we grow old because we stop playing.","George Bernard Shaw"],
["Logic will get you from A to Z; imagination will get you everywhere.","Albert Einstein"],
["Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.","Albert Einstein"],
["If you can dream it, you can do it.","Walt Disney"],
["All our dreams can come true, if we have the courage to pursue them.","Walt Disney"],
["The way to get started is to quit talking and begin doing.","Walt Disney"],
["It is during our darkest moments that we must focus to see the light.","Dalai Lama"],
["I destroy my enemies when I make them my friends.","Abraham Lincoln"],
["The only impossible journey is the one you never begin.","Tony Robbins"],
["Life shrinks or expands in proportion to one's courage.","Anaïs Nin"],
["We are all in the gutter, but some of us are looking at the stars.","Oscar Wilde"],
["Be yourself; everyone else is already taken.","Oscar Wilde"],
["To live is the rarest thing in the world. Most people exist, that is all.","Oscar Wilde"],
["Experience is merely the name men gave to their mistakes.","Oscar Wilde"],
["Keep your face always toward the sunshine — and shadows will fall behind you.","Walt Whitman"],
["Not I, nor anyone else can travel that road for you. You must travel it by yourself.","Walt Whitman"],
["I exist as I am, that is enough.","Walt Whitman"],
["Do I contradict myself? Very well then I contradict myself. I am large, I contain multitudes.","Walt Whitman"],
["The eye sees only what the mind is prepared to comprehend.","Robertson Davies"],
["No great mind has ever existed without a touch of madness.","Aristotle"],
["Pleasure in the job puts perfection in the work.","Aristotle"],
["The whole is greater than the sum of its parts.","Aristotle"],
["Patience is bitter, but its fruit is sweet.","Aristotle"],
["The mind that opens to a new idea never returns to its original size.","Albert Einstein"],
["Research is what I'm doing when I don't know what I'm doing.","Wernher von Braun"]
];

(function(){
  const el=$('#daily-quote');if(!el)return;
  // Deterministic daily index from date string hash
  const ds=new Date().toDateString();
  let h=0;for(let i=0;i<ds.length;i++){h=((h<<5)-h)+ds.charCodeAt(i);h|=0}
  const idx=Math.abs(h)%_QUOTES.length;
  const[text,author]=_QUOTES[idx];
  el.innerHTML='<span class="dq-text">'+text+'</span> <span class="dq-author">— '+author+'</span>';
  if(text.length>100)el.classList.add('dq-long');
})();

// ═══ THEME TOGGLE ═══
function toggleTheme(){
  const html=document.documentElement;
  const isLight=html.classList.toggle('light');
  localStorage.setItem('meridian_theme',isLight?'light':'dark');
  _updatePL();
  $('#themeToggle').innerHTML=isLight?'&#9788;':'&#9789;';
  // Update Plotly chart backgrounds if any exist
  document.querySelectorAll('.js-plotly-plot').forEach(el=>{
    try{Plotly.relayout(el,{'paper_bgcolor':PL.paper_bgcolor,'plot_bgcolor':PL.plot_bgcolor,
      'font.color':PL.font.color,'xaxis.gridcolor':PL.xaxis.gridcolor,
      'yaxis.gridcolor':PL.yaxis.gridcolor})}catch{}})}
// Restore theme on load
(function(){const t=localStorage.getItem('meridian_theme');if(t==='light'){document.documentElement.classList.add('light');_updatePL();const btn=$('#themeToggle');if(btn)btn.innerHTML='&#9788;'}})();

// ═══ TIP POPOVER ═══
function toggleTipPopover(btn){const tip=btn.nextElementSibling;if(!tip)return;const isOpen=tip.classList.toggle('open');tip.style.display=isOpen?'flex':'none'}

// ═══ GLOSSARY ═══
const _GLOSSARY={
  'Mann-Kendall':'Non-parametric trend test. Determines if a time series has a monotonic upward or downward trend without assuming normality.',
  'Sen\'s Slope':'Robust estimator of linear trend rate, paired with Mann-Kendall. Resistant to outliers — uses median of all pairwise slopes.',
  'Pearson r':'Parametric correlation coefficient (-1 to +1). Measures linear relationship strength. Assumes both variables are normally distributed.',
  'Spearman ρ':'Rank-based correlation coefficient. Non-parametric alternative to Pearson — works with monotonic (not just linear) relationships.',
  'LTTB':'Largest-Triangle-Three-Buckets. Downsampling algorithm that preserves visual shape of time series while reducing point count.',
  'Anomaly':'A data point that deviates significantly (typically >2 standard deviations) from the local mean.',
  'ANOVA':'Analysis of Variance. Tests whether means differ among 3+ groups. One-way ANOVA assumes normality and equal variances.',
  'Tukey HSD':'Honest Significant Difference. Post-hoc test after ANOVA to determine which specific group pairs differ significantly.',
  'Shapiro-Wilk':'Normality test. Tests whether data comes from a normal distribution. Low p-value (<0.05) suggests non-normality.',
  'p-value':'Probability of observing results at least as extreme as measured, if the null hypothesis were true. Not the probability the hypothesis is true.',
  'Effect Size':'Magnitude of a difference or relationship, independent of sample size. Cohen\'s d: 0.2=small, 0.5=medium, 0.8=large.',
  'Power':'Probability of detecting a real effect (1 - Type II error rate). Conventionally, 80% power is considered adequate.',
  'SST':'Sea Surface Temperature. Measured by satellites (AVHRR, MODIS, VIIRS) and in situ (buoys, Argo floats).',
  'Chlorophyll-a':'Photosynthetic pigment used as a proxy for phytoplankton biomass. Higher values indicate greater primary productivity.',
  'ERDDAP':'Environmental Research Division Data Access Program. NOAA server protocol for distributing scientific gridded datasets.',
  'GLM':'Generalized Linear Model. Extends linear regression to non-normal response distributions (Poisson for counts, Binomial for proportions).',
  'AIC':'Akaike Information Criterion. Model selection metric — lower is better. Balances goodness of fit against model complexity.',
  'BIC':'Bayesian Information Criterion. Similar to AIC but penalizes complexity more heavily. Preferred for larger datasets.',
  'PERMANOVA':'Permutational ANOVA. Non-parametric multivariate test using distance matrices. Tests whether group centroids differ in multivariate space.',
  'PCA':'Principal Component Analysis. Reduces many correlated variables into fewer uncorrelated components that explain most variance.',
  'Kruskal-Wallis':'Non-parametric alternative to one-way ANOVA. Compares medians across 3+ groups without assuming normality.',
  'R²':'Coefficient of determination. Proportion of variance in the dependent variable explained by the model (0 to 1).',
  'VIF':'Variance Inflation Factor. Detects multicollinearity between predictors. VIF >5 suggests problematic correlation between predictors.',
  'Eta²':'Effect size for ANOVA. Proportion of total variance explained by the grouping factor. Similar interpretation to R².',
  'Hardy-Weinberg':'Equilibrium model predicting genotype frequencies from allele frequencies in idealized populations (no selection, drift, migration, mutation).',
  'Fst':'Fixation index. Measures genetic differentiation between populations (0=no differentiation, 1=complete fixation).',
  'Shannon H\'':'Shannon-Wiener diversity index. Higher values indicate greater diversity. Accounts for both richness and evenness.',
  'Simpson D':'Probability that two randomly chosen individuals belong to the same species. 1-D gives diversity; higher = more diverse.',
  'Rarefaction':'Technique to estimate expected species richness at standardized sample sizes. Enables fair comparison across unequal sampling effort.',
  'Holt-Winters':'Triple exponential smoothing method for time series forecasting that handles level, trend, and seasonal components.',
  'ARIMA':'Autoregressive Integrated Moving Average. Statistical model for time series forecasting combining AR, differencing, and MA components.',
  'Leslie Matrix':'Age-structured population model. Projects population growth using age-specific survival rates and fecundities.',
  'Beverton-Holt':'Stock-recruitment model. Describes relationship between spawning biomass and recruitment with density-dependent regulation.',
  'MaxEnt':'Maximum Entropy. Machine learning method for species distribution modeling using presence-only data and environmental predictors.',
  'SDM':'Species Distribution Model. Predicts geographic range of species based on environmental conditions at known occurrence locations.',
  'Mark-Recapture':'Population estimation method. Capture, mark, release, recapture — ratio of marked to unmarked estimates total population (Lincoln-Petersen).',
  'CPUE':'Catch Per Unit Effort. Standard fisheries abundance index. Assumes proportionality between catch rate and population size.',
  'SLA':'Sea Level Anomaly. Deviation of sea surface height from the long-term mean. Indicates ocean circulation patterns and eddies.',
  'ONI':'Oceanic Niño Index. 3-month running mean of SST anomalies in Niño 3.4 region. El Niño ≥+0.5°C, La Niña ≤-0.5°C.',
  'PDO':'Pacific Decadal Oscillation. Long-lived pattern of Pacific climate variability. Warm/cool phases lasting 20-30 years.',
  'NAO':'North Atlantic Oscillation. Pressure difference between Icelandic Low and Azores High. Influences weather patterns across Atlantic.',
  'Bayes Factor':'Ratio of evidence for one hypothesis over another. BF>3 = moderate evidence, BF>10 = strong evidence.',
  'MCMC':'Markov Chain Monte Carlo. Computational method for sampling from probability distributions. Used in Bayesian statistics.',
  'Random Forest':'Ensemble of decision trees. Each tree trained on bootstrap sample with random feature subsets. Robust to overfitting.',
  'K-means':'Unsupervised clustering algorithm. Partitions data into K groups by minimizing within-cluster variance.',
  'Cross-validation':'Model evaluation technique. Splits data into folds — trains on all-but-one fold, tests on held-out fold. Reduces overfitting.',
  'Confidence Interval':'Range of values likely to contain the true parameter. 95% CI: if we repeated the study 100 times, ~95 intervals would contain the true value.',
  'Null Hypothesis':'Default assumption of no effect or no difference. Statistical tests evaluate evidence against this assumption.',
  'Type I Error':'False positive. Rejecting the null hypothesis when it is actually true. Probability = α (usually 0.05).',
  'Type II Error':'False negative. Failing to reject the null hypothesis when it is actually false. Probability = β; Power = 1-β.'
};
function showGlossary(){
  const overlay=document.createElement('div');overlay.className='meridian-modal-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  const terms=Object.entries(_GLOSSARY).sort((a,b)=>a[0].localeCompare(b[0]));
  overlay.innerHTML=`<div class="meridian-modal" style="position:relative"><button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3>Scientific Glossary</h3>
    <input class="glossary-search" id="glossaryFilter" placeholder="Search terms..." oninput="filterGlossary(this.value)"/>
    <div id="glossaryList">${terms.map(([t,d])=>`<div class="glossary-item"><div class="gl-term">${escHTML(t)}</div><div class="gl-def">${escHTML(d)}</div></div>`).join('')}</div></div>`;
  document.body.appendChild(overlay);$('#glossaryFilter')?.focus()}
function filterGlossary(q){
  q=q.toLowerCase();const items=$$('#glossaryList .glossary-item');
  items.forEach(el=>{const t=el.querySelector('.gl-term').textContent.toLowerCase();
    const d=el.querySelector('.gl-def').textContent.toLowerCase();
    el.style.display=(t.includes(q)||d.includes(q))?'':'none'})}

// ═══ GUIDED WORKFLOWS ═══
// ═══ CUSTOMIZABLE WORKFLOWS ═══
const _DEFAULT_WORKFLOWS=[
  {name:'Coral Bleaching Assessment',desc:'Analyze thermal stress indicators and bleaching risk using SST, SST anomaly, bleaching alert area, and hotspot data.',
    vars:['sst','sst_anom','baa','hotspot','chlor'],dateRange:365,
    guidance:'Look for SST >29°C and elevated BAA levels. Declining chlorophyll may indicate reef stress. Compare hotspot and BAA levels across time.',
    thresholds:[{var:'sst',op:'>',val:29,label:'Bleaching risk SST'}],builtin:true},
  {name:'Upwelling Detection',desc:'Identify coastal upwelling events via SST cooling, wind patterns, and chlorophyll blooms.',
    vars:['sst','ws','wdir','chlor','sal','curr_u','curr_v'],dateRange:180,
    guidance:'Upwelling signatures: sudden SST drops (2-5°C), elevated chlorophyll (>1 mg/m³), equatorward winds. Check current direction for offshore Ekman transport.',
    thresholds:[{var:'chlor',op:'>',val:1,label:'Bloom indicator'}],builtin:true},
  {name:'Water Quality Report',desc:'Comprehensive water quality snapshot using turbidity proxies, chlorophyll, salinity, and atmospheric conditions.',
    vars:['chlor','sal','sst','par','at','pp','cl'],dateRange:90,
    guidance:'Kd490 >0.3 m⁻¹ suggests turbid water. High chlorophyll + low Kd490 = algal bloom. Compare salinity deviations with precipitation events.',
    thresholds:[{var:'par',op:'>',val:0.3,label:'Turbid water'}],builtin:true},
  {name:'Climate Trend Analysis',desc:'Long-term climate signals using SST trends, CO₂, sea level, and sea ice extent.',
    vars:['sst','co2','sla','seaice','at','sst_anom'],dateRange:3650,
    guidance:'Apply Mann-Kendall trend tests. Look for accelerating SST trends, CO₂ >420 ppm baseline, positive SLA trends, declining sea ice fraction.',
    thresholds:[{var:'co2',op:'>',val:420,label:'Above baseline'}],builtin:true},
  {name:'Fisheries Habitat Assessment',desc:'Evaluate habitat suitability for target species using temperature, productivity, currents, and depth.',
    vars:['sst','chlor','npp','sal','curr_u','curr_v','depth','wh'],dateRange:365,
    guidance:'Cross-reference species thermal preferences with SST range. High NPP areas indicate productive feeding grounds. Current patterns reveal larval transport routes.',
    thresholds:[],builtin:true},
  {name:'Storm Impact Analysis',desc:'Assess storm impacts on marine environments using wave, wind, SST, and atmospheric data.',
    vars:['wh','sh','wp','ws','wdir','pr','sst','at','pp'],dateRange:30,
    guidance:'Wave height >4m = significant storm. Track SST cooling from mixing (storm-induced upwelling). Compare pre/post atmospheric pressure drops.',
    thresholds:[{var:'wh',op:'>',val:4,label:'Significant storm'}],builtin:true}
];
function _loadWorkflows(){
  const saved=safeParse('meridian_workflows',null);
  if(!saved)return _DEFAULT_WORKFLOWS.map(w=>({...w}));
  return saved}
function _saveWorkflows(wfs){safeStore('meridian_workflows',wfs)}
function _getWorkflows(){return _loadWorkflows()}

function showWorkflows(){
  const wfs=_getWorkflows();
  const overlay=document.createElement('div');overlay.className='meridian-modal-overlay';overlay.id='wf-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  _renderWorkflowList(overlay,wfs);
  document.body.appendChild(overlay)}

function _renderWorkflowList(overlay,wfs){
  overlay.innerHTML=`<div class="meridian-modal" style="position:relative;max-width:780px">
    <button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3>Analysis Workflows</h3>
    <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">
      <p style="font-size:12px;color:var(--ts);flex:1">Select a workflow to load, or create your own custom analysis recipe.</p>
      <button class="bt bt-pri" onclick="openWorkflowEditor(-1)" style="white-space:nowrap">+ New Workflow</button>
      <button class="bt sm" onclick="resetWorkflowDefaults()" style="font-size:10px;white-space:nowrap">Reset Defaults</button>
    </div>
    <div id="wf-list">${wfs.map((w,i)=>_workflowCardHTML(w,i)).join('')}</div>
    <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="bt sm" onclick="exportWorkflows()">Export All</button>
      <button class="bt sm" onclick="importWorkflows()">Import</button>
    </div></div>`}

function _workflowCardHTML(w,i){
  const varNames=w.vars.map(v=>{const ev=EV.find(x=>x.id===v);return ev?ev.nm:v}).join(', ');
  const rangeLabel=w.dateRange>=365?Math.round(w.dateRange/365)+'yr':w.dateRange+'d';
  const threshCount=w.thresholds?.length||0;
  return`<div class="wf-card" style="position:relative">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1;cursor:pointer" onclick="applyWorkflow(${i})">
        <h4>${escHTML(w.name)}${w.builtin?'<span style="font-size:9px;color:var(--tm);font-weight:400;margin-left:6px">BUILT-IN</span>':''}</h4>
        <p>${escHTML(w.desc)}</p>
        <div class="wf-vars">${w.vars.length} vars: ${varNames} · ${rangeLabel}${threshCount?' · '+threshCount+' threshold'+(threshCount>1?'s':''):''}</div>
      </div>
      <div style="display:flex;gap:3px;flex-shrink:0">
        <button class="bt sm" onclick="event.stopPropagation();openWorkflowEditor(${i})" title="Edit" style="padding:4px 8px;font-size:11px">Edit</button>
        <button class="bt sm" onclick="event.stopPropagation();duplicateWorkflow(${i})" title="Duplicate" style="padding:4px 8px;font-size:11px">Dup</button>
        <button class="bt sm" onclick="event.stopPropagation();deleteWorkflow(${i})" title="Delete" style="padding:4px 8px;font-size:11px;color:var(--co)">×</button>
      </div>
    </div></div>`}

function applyWorkflow(idx){
  const wfs=_getWorkflows();const w=wfs[idx];if(!w)return;
  goTab('env');
  S.envSel=new Set(w.vars);renderEV();
  setDateRange(w.dateRange);
  openEnvGroup('loc');openEnvGroup('vars');
  window._activeWorkflow=w;
  document.querySelector('.meridian-modal-overlay')?.remove();
  toast('Workflow loaded: '+w.name+'. Set coordinates and click Fetch.','ok',5000);
  _updateQueryMeter()}

function openWorkflowEditor(idx){
  const wfs=_getWorkflows();
  const isNew=idx<0;
  const w=isNew?{name:'',desc:'',vars:[],dateRange:365,guidance:'',thresholds:[]}:{...wfs[idx],thresholds:[...(wfs[idx].thresholds||[])]};
  // Replace the modal content with the editor
  const overlay=$('#wf-overlay');if(!overlay)return;
  const cats=[...new Set(EV.map(v=>v.cat))];
  overlay.innerHTML=`<div class="meridian-modal" style="position:relative;max-width:780px">
    <button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3>${isNew?'Create':'Edit'} Workflow</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">NAME</label>
        <input class="si" id="wfe-name" value="${escHTML(w.name)}" placeholder="e.g. Reef Monitoring Protocol" style="width:100%"/>
      </div>
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">DESCRIPTION</label>
        <input class="si" id="wfe-desc" value="${escHTML(w.desc)}" placeholder="What this workflow analyzes and why" style="width:100%"/>
      </div>
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">VARIABLES <span id="wfe-var-count" style="color:var(--ac)">(${w.vars.length} selected)</span></label>
        <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">
          <button class="bt sm" onclick="_wfeSelectAll()" style="font-size:10px">All</button>
          <button class="bt sm" onclick="_wfeClearAll()" style="font-size:10px">Clear</button>
          ${cats.map(c=>`<button class="bt sm" onclick="_wfeToggleCat('${c}')" style="font-size:10px" title="Toggle ${c}">${c}</button>`).join('')}
        </div>
        <div id="wfe-vars" style="display:flex;flex-wrap:wrap;gap:4px;max-height:160px;overflow-y:auto;padding:8px;background:var(--bi);border:1px solid var(--bd);border-radius:6px">
          ${EV.map(v=>`<span class="vc ${w.vars.includes(v.id)?'sel':''}" data-id="${v.id}" onclick="_wfeToggleVar('${v.id}',this)" title="${v.cat}: ${v.nm} (${v.u})">${v.nm}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px">
          <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">DATE RANGE (days)</label>
          <input class="fi" id="wfe-range" type="number" value="${w.dateRange}" min="1" max="36500" style="width:100%"/>
          <div style="display:flex;gap:3px;margin-top:4px">
            <button class="bt sm" onclick="$('#wfe-range').value=30" style="font-size:10px;padding:2px 6px">30d</button>
            <button class="bt sm" onclick="$('#wfe-range').value=90" style="font-size:10px;padding:2px 6px">90d</button>
            <button class="bt sm" onclick="$('#wfe-range').value=365" style="font-size:10px;padding:2px 6px">1yr</button>
            <button class="bt sm" onclick="$('#wfe-range').value=1825" style="font-size:10px;padding:2px 6px">5yr</button>
            <button class="bt sm" onclick="$('#wfe-range').value=3650" style="font-size:10px;padding:2px 6px">10yr</button>
          </div>
        </div>
      </div>
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">INTERPRETIVE GUIDANCE</label>
        <textarea class="si" id="wfe-guidance" rows="3" placeholder="What to look for in the results, threshold values, interpretation tips..." style="width:100%;resize:vertical;font-size:13px;line-height:1.5">${escHTML(w.guidance)}</textarea>
      </div>
      <div>
        <label style="font-size:11px;color:var(--tm);font-family:var(--mf);display:block;margin-bottom:3px">Alert Thresholds <button class="bt sm" onclick="_wfeAddThreshold()" style="font-size:10px;padding:2px 8px;margin-left:6px">+ Add</button></label>
        <div id="wfe-thresholds" style="display:flex;flex-direction:column;gap:4px">
          ${(w.thresholds||[]).map((t,ti)=>_thresholdRowHTML(t,ti)).join('')}
        </div>
        <div style="font-size:10px;color:var(--tm);margin-top:4px">Thresholds trigger visual alerts on charts when values cross the defined limits.</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:4px;justify-content:flex-end">
        <button class="bt sm" onclick="_renderWorkflowList($('#wf-overlay'),_getWorkflows())">Cancel</button>
        <button class="bt bt-pri" onclick="saveWorkflowFromEditor(${idx})">${isNew?'Create Workflow':'Save Changes'}</button>
      </div>
    </div></div>`;
  // Store current threshold data for the editor
  window._wfeThresholds=w.thresholds||[]}

function _thresholdRowHTML(t,ti){
  const varOpts=EV.map(v=>`<option value="${v.id}" ${t.var===v.id?'selected':''}>${v.nm} (${v.u})</option>`).join('');
  return`<div class="wfe-thresh-row" style="display:flex;gap:4px;align-items:center;flex-wrap:wrap" data-idx="${ti}">
    <select class="fs" style="font-size:11px;padding:4px" onchange="window._wfeThresholds[${ti}].var=this.value">${varOpts}</select>
    <select class="fs" style="font-size:11px;padding:4px;width:50px" onchange="window._wfeThresholds[${ti}].op=this.value">
      <option value=">" ${t.op==='>'?'selected':''}>&gt;</option><option value=">=" ${t.op==='>='?'selected':''}>&ge;</option>
      <option value="<" ${t.op==='<'?'selected':''}>&lt;</option><option value="<=" ${t.op==='<='?'selected':''}>&le;</option>
    </select>
    <input class="fi" type="number" step="any" value="${t.val}" style="width:70px;font-size:11px;padding:4px" onchange="window._wfeThresholds[${ti}].val=parseFloat(this.value)"/>
    <input class="fi" value="${escHTML(t.label||'')}" placeholder="Label" style="flex:1;min-width:80px;font-size:11px;padding:4px" onchange="window._wfeThresholds[${ti}].label=this.value"/>
    <button class="bt sm" onclick="_wfeRemoveThreshold(${ti})" style="padding:2px 6px;font-size:11px;color:var(--co)">×</button></div>`}

function _wfeToggleVar(id,el){el.classList.toggle('sel');
  const cnt=$$('#wfe-vars .vc.sel').length;$('#wfe-var-count').textContent='('+cnt+' selected)'}
function _wfeSelectAll(){$$('#wfe-vars .vc').forEach(el=>el.classList.add('sel'));
  $('#wfe-var-count').textContent='('+EV.length+' selected)'}
function _wfeClearAll(){$$('#wfe-vars .vc').forEach(el=>el.classList.remove('sel'));
  $('#wfe-var-count').textContent='(0 selected)'}
function _wfeToggleCat(cat){const ids=EV.filter(v=>v.cat===cat).map(v=>v.id);
  const chips=$$('#wfe-vars .vc');const catChips=[...chips].filter(c=>ids.includes(c.dataset.id));
  const allSel=catChips.every(c=>c.classList.contains('sel'));
  catChips.forEach(c=>c.classList.toggle('sel',!allSel));
  const cnt=$$('#wfe-vars .vc.sel').length;$('#wfe-var-count').textContent='('+cnt+' selected)'}
function _wfeAddThreshold(){
  window._wfeThresholds=window._wfeThresholds||[];
  const t={var:EV[0].id,op:'>',val:0,label:''};
  window._wfeThresholds.push(t);
  const el=$('#wfe-thresholds');
  el.insertAdjacentHTML('beforeend',_thresholdRowHTML(t,window._wfeThresholds.length-1))}
function _wfeRemoveThreshold(ti){
  window._wfeThresholds.splice(ti,1);
  // Re-render all thresholds to fix indices
  const el=$('#wfe-thresholds');
  el.innerHTML=window._wfeThresholds.map((t,i)=>_thresholdRowHTML(t,i)).join('')}

function saveWorkflowFromEditor(idx){
  const name=$('#wfe-name').value.trim();
  if(!name){toast('Workflow needs a name','err');return}
  const vars=[...$$('#wfe-vars .vc.sel')].map(el=>el.dataset.id);
  if(!vars.length){toast('Select at least one variable','err');return}
  const wf={
    name,
    desc:$('#wfe-desc').value.trim(),
    vars,
    dateRange:parseInt($('#wfe-range').value)||365,
    guidance:$('#wfe-guidance').value.trim(),
    thresholds:(window._wfeThresholds||[]).filter(t=>t.var&&t.val!==undefined),
    builtin:false
  };
  const wfs=_getWorkflows();
  if(idx<0)wfs.push(wf);
  else wfs[idx]=wf;
  _saveWorkflows(wfs);
  _renderWorkflowList($('#wf-overlay'),wfs);
  toast(idx<0?'Workflow created':'Workflow updated','ok')}

function duplicateWorkflow(idx){
  const wfs=_getWorkflows();const w=wfs[idx];if(!w)return;
  const copy={...w,name:w.name+' (copy)',vars:[...w.vars],thresholds:[...(w.thresholds||[]).map(t=>({...t}))],builtin:false};
  wfs.splice(idx+1,0,copy);
  _saveWorkflows(wfs);
  _renderWorkflowList($('#wf-overlay'),wfs);
  toast('Workflow duplicated','ok')}

function deleteWorkflow(idx){
  const wfs=_getWorkflows();
  if(!confirm('Delete workflow "'+wfs[idx].name+'"?'))return;
  wfs.splice(idx,1);
  _saveWorkflows(wfs);
  _renderWorkflowList($('#wf-overlay'),wfs);
  toast('Workflow deleted','ok')}

function resetWorkflowDefaults(){
  if(!confirm('Reset all workflows to defaults? Custom workflows will be lost.'))return;
  localStorage.removeItem('meridian_workflows');
  _renderWorkflowList($('#wf-overlay'),_getWorkflows());
  toast('Workflows reset to defaults','ok')}

function exportWorkflows(){
  const wfs=_getWorkflows();
  dl(JSON.stringify(wfs,null,2),'meridian-workflows.json','application/json');
  toast('Workflows exported','ok')}

function importWorkflows(){
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.onchange=e=>{const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{try{
      const imported=JSON.parse(ev.target.result);
      if(!Array.isArray(imported)){toast('Invalid workflow file','err');return}
      const valid=imported.filter(w=>w.name&&Array.isArray(w.vars));
      if(!valid.length){toast('No valid workflows found in file','err');return}
      const wfs=_getWorkflows();
      valid.forEach(w=>{w.builtin=false;wfs.push(w)});
      _saveWorkflows(wfs);
      _renderWorkflowList($('#wf-overlay'),wfs);
      toast(valid.length+' workflow(s) imported','ok')}
    catch{toast('Failed to parse workflow file','err')}};
    reader.readAsText(file)};
  input.click()}

// Save current env state as a new workflow (quick capture)
function saveCurrentAsWorkflow(){
  const vars=[...S.envSel];
  if(!vars.length){toast('Select some variables first','err');return}
  const name=prompt('Workflow name:');if(!name)return;
  const df=$('#edf')?.value,dt=$('#edt')?.value;
  let dateRange=365;
  if(df&&dt){dateRange=Math.max(1,Math.round((new Date(dt)-new Date(df))/86400000))}
  const wf={name,desc:'Custom workflow saved from current selection',vars,dateRange,
    guidance:'',thresholds:[],builtin:false};
  const wfs=_getWorkflows();wfs.push(wf);_saveWorkflows(wfs);
  toast('Workflow saved: '+name,'ok')}

// ═══ DATA PROVENANCE STAMPS ═══
function stampProvenance(varId,meta){
  S.envProvenance[varId]={fetchedAt:new Date().toISOString(),server:meta.server||'N/A',dataset:meta.dataset||'N/A',
    stride:meta.stride||'1',coordsUsed:{lat:meta.lat,lon:meta.lon},dateRange:{from:meta.from,to:meta.to},
    variable:meta.variable||varId,source:meta.source||'unknown'}}
function getProvenanceHTML(varId){
  const p=S.envProvenance[varId];if(!p)return'';
  return`<span class="prov-badge" title="Provenance: ${escHTML(p.server)}\nDataset: ${escHTML(p.dataset)}\nFetched: ${p.fetchedAt}\nCoords: ${p.coordsUsed?.lat||'?'}°N, ${p.coordsUsed?.lon||'?'}°E\nRange: ${p.dateRange?.from||'?'} to ${p.dateRange?.to||'?'}">&#x1f4cb; Provenance</span>`}

// ═══ REPRODUCIBILITY BUNDLE EXPORT ═══
function exportReproBundle(){
  const bundle={version:'1.0',exportedAt:new Date().toISOString(),platform:'Meridian',
    settings:{lat:$('#elat')?.value,lon:$('#elon')?.value,mode:$('#emode')?.value,
      dateFrom:$('#edf')?.value,dateTo:$('#edt')?.value,selectedVars:[...S.envSel],
      fusionMode:_fusionMode,seasonalFilter:getSeasonalMonths(),skillLevel:S.skillLevel},
    provenance:S.envProvenance,
    data:{},statistics:{},workflow:window._activeWorkflow||null};
  // Include all env time series data
  Object.keys(S.envTS).forEach(id=>{
    bundle.data[id]={name:S.envTS[id].nm,unit:S.envTS[id].u,points:S.envTS[id].data.length,
      values:S.envTS[id].data}});
  // Include summary stats
  Object.keys(S.envR).forEach(id=>{
    bundle.statistics[id]={value:S.envR[id].value,unit:S.envR[id].u,name:S.envR[id].nm}});
  // Mann-Kendall trends
  Object.keys(S.envTS).forEach(id=>{
    let d=S.envTS[id].data;if(d&&d.length>=10){if(d.length>300)d=lttb(d,300);
      const mk=mannKendall(d);if(mk)bundle.statistics[id+'_trend']={test:'Mann-Kendall',trend:mk.trend,p:mk.p,slope:mk.slope,label:mk.label}}});
  // Quality assessments
  Object.keys(S.envTS).forEach(id=>{
    const q=assessQuality(S.envTS[id].data);bundle.statistics[id+'_quality']=q});
  const json=JSON.stringify(bundle,null,2);
  dl(json,'meridian-analysis-bundle-'+new Date().toISOString().slice(0,10)+'.json','application/json');
  toast('Reproducibility bundle exported','ok')}

// ═══ SHAREABLE ANALYSIS LINKS ═══
function shareAnalysisLink(){
  const state={lat:$('#elat')?.value||'',lon:$('#elon')?.value||'',vars:[...S.envSel].join(','),
    mode:$('#emode')?.value||'timeseries',df:$('#edf')?.value||'',dt:$('#edt')?.value||'',
    skill:S.skillLevel};
  const encoded=btoa(JSON.stringify(state));
  const url=location.origin+location.pathname+'#state='+encoded;
  navigator.clipboard?.writeText(url).then(()=>toast('Link copied to clipboard','ok')).catch(()=>{
    prompt('Copy this link:',url)})}
function loadSharedState(){
  const hash=location.hash;if(!hash.includes('#state='))return;
  try{const encoded=hash.split('#state=')[1];const state=JSON.parse(atob(encoded));
    if(typeof state!=='object'||state===null)return;
    // Validate numeric lat/lon
    if(state.lat&&isFinite(+state.lat))$('#elat').value=+state.lat;
    if(state.lon&&isFinite(+state.lon))$('#elon').value=+state.lon;
    // Validate var IDs against known EV catalogue
    if(state.vars&&typeof state.vars==='string'){const known=typeof EV!=='undefined'?new Set(EV.map(v=>v.id)):null;const ids=state.vars.split(',').filter(v=>v&&(!known||known.has(v)));S.envSel=new Set(ids);if(typeof renderEV==='function')renderEV()}
    if(state.mode&&['latest','timeseries','depthprofile'].includes(state.mode))$('#emode').value=state.mode;
    if(state.df&&/^\d{4}-\d{2}-\d{2}$/.test(state.df))$('#edf').value=state.df;
    if(state.dt&&/^\d{4}-\d{2}-\d{2}$/.test(state.dt))$('#edt').value=state.dt;
    if(state.skill&&['beginner','intermediate','advanced'].includes(state.skill)){S.skillLevel=state.skill;safeStore('meridian_skill',state.skill)}
    goTab('env');openEnvGroup('loc');
    toast('Shared analysis loaded','ok');location.hash=''}catch(e){console.warn('Invalid shared state',e)}}

// ═══ SKILL LEVEL MANAGEMENT ═══
function setSkillLevel(level){
  S.skillLevel=level;safeStore('meridian_skill',level);
  document.querySelectorAll('[data-skill]').forEach(el=>{
    const req=el.dataset.skill;
    if(req==='advanced')el.classList.toggle('skill-hidden',level==='beginner');
    else if(req==='expert')el.classList.toggle('skill-hidden',level!=='advanced')});
  toast('Skill level: '+level,'ok')}

// ═══ SETTINGS PAGE ═══
function toggleSettingsGroup(g){
  const b=$('#settings-'+g+'-body'),a=$('#settings-'+g+'-arrow');
  if(!b)return;
  const show=b.style.display==='none';
  b.style.display=show?'':'none';
  if(a)a.textContent=show?'▾':'▸';
}

function initSettings(){
  _refreshDisplayButtons();
  _refreshSidebarBehaviorButtons();
  _loadProfile();
}

// ── Display settings ──
function setThemeFromSettings(theme){
  const isLight=document.documentElement.classList.contains('light');
  if((theme==='light')!==isLight)toggleTheme();
  _refreshDisplayButtons();
}

function setFontSize(px){
  document.body.style.fontSize=px+'px';
  localStorage.setItem('meridian_fontsize',px);
  _refreshDisplayButtons();
  toast('Font size: '+px+'px','ok');
}

function setSidebarBehavior(mode){
  localStorage.setItem('meridian_sb_behavior',mode);
  _applySidebarBehavior(mode);
  _refreshSidebarBehaviorButtons();
  toast('Sidebar: '+mode,'ok');
}

function _applySidebarBehavior(mode){
  const sb=$('#sidebar');
  if(!sb)return;
  if(mode==='click'){
    sb.classList.add('sb-no-hover');
  }else{
    sb.classList.remove('sb-no-hover');
  }
}

function _refreshDisplayButtons(){
  const isLight=document.documentElement.classList.contains('light');
  $$('.set-theme-btn').forEach(b=>{
    b.classList.toggle('on',b.dataset.theme===(isLight?'light':'dark'));
  });
  const curSize=parseInt(localStorage.getItem('meridian_fontsize'))||15;
  $$('.set-font-btn').forEach(b=>{
    b.classList.toggle('on',parseInt(b.dataset.size)===curSize);
  });
}

function _refreshSidebarBehaviorButtons(){
  const cur=localStorage.getItem('meridian_sb_behavior')||'hover';
  $$('.set-sb-btn').forEach(b=>{
    b.classList.toggle('on',b.dataset.sbbehavior===cur);
  });
}

// ── Profile settings ──
async function _getAuthUser(){
  if(window._supaUser)return window._supaUser;
  if(!window.SB)return null;
  try{
    const{data:{session}}=await SB.auth.getSession();
    if(session?.user){window._supaUser=session.user;return session.user}
  }catch(e){console.warn('getSession:',e)}
  return null;
}

async function _loadProfile(){
  const user=await _getAuthUser();
  if(!window.SB||!user)return;
  try{
    const{data}=await SB.from('user_profiles').select('*').eq('user_id',user.id).maybeSingle();
    if(data){
      const dn=$('#set-displayname'),af=$('#set-affiliation'),or=$('#set-orcid');
      if(dn)dn.value=data.display_name||'';
      if(af)af.value=data.affiliation||'';
      if(or)or.value=data.orcid||'';
      const nc=$('#set-notify-comments'),nf=$('#set-notify-flags'),pp=$('#set-public-profile');
      if(nc)nc.checked=!!data.notify_comments;
      if(nf)nf.checked=!!data.notify_flags;
      if(pp)pp.checked=!!data.public_profile;
    }
  }catch(e){console.warn('Load profile:',e)}
}

async function saveProfile(){
  const user=await _getAuthUser();
  if(!window.SB||!user){toast('Sign in to save your profile','err');return}
  const msg=$('#set-profile-msg');
  if(msg){msg.style.color='var(--ac)';msg.textContent='Saving…'}
  const orcid=$('#set-orcid')?.value?.trim();
  if(orcid){
    const valid=await _validateOrcid(orcid);
    if(!valid){
      if(msg){msg.style.color='var(--co)';msg.textContent='Invalid ORCID iD'}
      return;
    }
  }
  const row={
    user_id:user.id,
    display_name:$('#set-displayname')?.value?.trim()||null,
    affiliation:$('#set-affiliation')?.value?.trim()||null,
    orcid:orcid||null,
    notify_comments:!!$('#set-notify-comments')?.checked,
    notify_flags:!!$('#set-notify-flags')?.checked,
    public_profile:!!$('#set-public-profile')?.checked,
    updated_at:new Date().toISOString()
  };
  try{
    const{data:existing}=await SB.from('user_profiles').select('id').eq('user_id',user.id).maybeSingle();
    if(existing)await SB.from('user_profiles').update(row).eq('id',existing.id);
    else await SB.from('user_profiles').insert(row);
    if(msg){msg.style.color='var(--sg)';msg.textContent='Saved';setTimeout(()=>msg.textContent='',3000)}
  }catch(e){
    console.error('Save profile:',e);
    if(msg){msg.style.color='var(--co)';msg.textContent='Error saving profile'}
  }
}

async function _validateOrcid(orcid){
  const status=$('#set-orcid-status');
  const pattern=/^\d{4}-\d{4}-\d{4}-[\dX]$/;
  if(!pattern.test(orcid)){
    if(status){status.style.color='var(--co)';status.textContent='✕ Invalid format'}
    return false;
  }
  if(status){status.style.color='var(--ac)';status.textContent='Verifying…'}
  try{
    const r=await fetch('https://pub.orcid.org/v3.0/'+orcid+'/record',{headers:{'Accept':'application/json'}});
    if(r.ok){
      if(status){status.style.color='var(--sg)';status.textContent='✓ Verified'}
      return true;
    }
    if(status){status.style.color='var(--co)';status.textContent='✕ Not found'}
    return false;
  }catch(e){
    if(status){status.style.color='var(--wa)';status.textContent='⚠ Could not verify'}
    return true;// allow save if API unreachable
  }
}

// ── Data & Privacy ──
async function exportMyData(){
  toast('Exporting data…','info');
  const out={exportedAt:new Date().toISOString(),user:null,publications:[],library:[],settings:null};
  try{
    const user=await _getAuthUser();
    if(window.SB&&user){
      out.user={id:user.id,email:user.email};
      const{data:pubs}=await SB.from('publications').select('*').eq('user_id',user.id);
      out.publications=pubs||[];
      const{data:papers}=await SB.from('library_papers').select('*').eq('user_id',user.id);
      out.library=papers||[];
      const{data:settings}=await SB.from('user_settings').select('*').eq('user_id',user.id).maybeSingle();
      out.settings=settings;
      const{data:profile}=await SB.from('user_profiles').select('*').eq('user_id',user.id).maybeSingle();
      out.profile=profile;
    }
    // Include local library
    if(typeof dbAll==='function'){
      const local=await dbAll();
      out.localLibrary=local||[];
    }
  }catch(e){console.warn('Export error:',e)}
  dl(JSON.stringify(out,null,2),'meridian-export-'+new Date().toISOString().slice(0,10)+'.json','application/json');
  toast('Data exported','ok');
}

async function clearLocalLibrary(){
  const overlay=document.createElement('div');
  overlay.className='meridian-modal-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML=`<div class="meridian-modal" style="max-width:440px;position:relative">
    <button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3 style="color:var(--wa)">Clear Local Library</h3>
    <p style="font-size:14px;color:var(--ts);line-height:1.6;margin-bottom:18px">This will remove all saved papers from your local library. Cloud-synced data will not be affected.</p>
    <p style="font-size:14px;color:var(--ts);margin-bottom:18px">Are you sure?</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="bt" onclick="this.closest('.meridian-modal-overlay').remove()">Cancel</button>
      <button class="bt" style="color:var(--co);border-color:rgba(194,120,120,.3)" onclick="_doClearLocal(this)">Yes, Clear Library</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

async function _doClearLocal(btn){
  btn.textContent='Clearing…';btn.disabled=true;
  try{
    const req=indexedDB.deleteDatabase('MeridianLib');
    req.onsuccess=()=>{
      window.db=null;
      if(typeof openDB==='function')openDB();
      btn.closest('.meridian-modal-overlay').remove();
      toast('Local library cleared','ok');
    };
    req.onerror=()=>{toast('Error clearing library','err');btn.closest('.meridian-modal-overlay').remove()};
  }catch(e){toast('Error: '+e.message,'err');btn.closest('.meridian-modal-overlay').remove()}
}

function deleteAccountStep1(){
  const overlay=document.createElement('div');
  overlay.className='meridian-modal-overlay';
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};
  overlay.innerHTML=`<div class="meridian-modal" style="max-width:440px;position:relative">
    <button class="mm-close" onclick="this.closest('.meridian-modal-overlay').remove()">×</button>
    <h3 style="color:var(--co)">Delete Account</h3>
    <p style="font-size:14px;color:var(--ts);line-height:1.6;margin-bottom:14px">This is permanent and cannot be undone. All your data will be deleted, including your publications, library, and profile.</p>
    <p style="font-size:14px;color:var(--ts);margin-bottom:12px">Type <strong style="color:var(--co)">DELETE</strong> to confirm:</p>
    <input class="si" id="delete-confirm-input" placeholder="Type DELETE" style="max-width:200px;margin-bottom:18px"/>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="bt" onclick="this.closest('.meridian-modal-overlay').remove()">Cancel</button>
      <button class="bt" id="delete-confirm-btn" style="color:#fff;background:var(--co);border-color:var(--co);opacity:.5;cursor:not-allowed" disabled onclick="_doDeleteAccount(this)">Delete My Account</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const inp=overlay.querySelector('#delete-confirm-input');
  const btn=overlay.querySelector('#delete-confirm-btn');
  inp.addEventListener('input',()=>{
    const ok=inp.value.trim()==='DELETE';
    btn.disabled=!ok;
    btn.style.opacity=ok?'1':'.5';
    btn.style.cursor=ok?'pointer':'not-allowed';
  });
}

async function _doDeleteAccount(btn){
  btn.textContent='Deleting…';btn.disabled=true;
  try{
    const user=await _getAuthUser();
    if(window.SB&&user){
      const uid=user.id;
      await SB.from('library_papers').delete().eq('user_id',uid);
      await SB.from('user_settings').delete().eq('user_id',uid);
      await SB.from('user_profiles').delete().eq('user_id',uid);
      await SB.from('publications').delete().eq('user_id',uid);
      await SB.from('user_roles').delete().eq('user_id',uid);
      // Sign out — full account deletion requires a server-side admin call
      // but we clear all user data and sign out
      await SB.auth.signOut();
    }
    // Clear local data
    indexedDB.deleteDatabase('MeridianLib');
    localStorage.clear();
    btn.closest('.meridian-modal-overlay').remove();
    toast('Account data deleted. You have been signed out.','ok');
    setTimeout(()=>location.reload(),1500);
  }catch(e){
    console.error('Delete account:',e);
    toast('Error deleting account: '+e.message,'err');
    btn.textContent='Delete My Account';btn.disabled=false;
  }
}

// Apply saved display preferences on page load
(function(){
  const fs=localStorage.getItem('meridian_fontsize');
  if(fs)document.body.style.fontSize=fs+'px';
  const sb=localStorage.getItem('meridian_sb_behavior');
  if(sb==='click'){const el=$('#sidebar');if(el)el.classList.add('sb-no-hover')}
})();

// ═══ TOAST ═══
