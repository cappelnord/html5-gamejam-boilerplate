// THIS LIBRARY IS NOT FINISHED AND A TOTAL MESS.
// IF YOU USE IT YOU WILL SUFFER!


// _zinedine.js

// Crockford extensions

if (typeof Object.beget !== 'function') {
    Object.beget = function(o) {
        var F = function() {};
        F.prototype = o;
        return new F();
    }
};

Function.prototype.method = function (name, func) {
    if(!this.prototype[name]) {
        this.prototype[name] = func;
    }
};

Function.method('curry', function() {
    var slice = Array.prototype.slice,
        args = slice.apply(arguments),
        that = this;
    return function() {
        return that.apply(null, args.concat(slice.apply(arguments)));
    };
});

// Shit that hopefully goes away (replace all occurences if it's soweit ...)

ZinedineLegacy = {}

ZinedineLegacy.oldschool = false;

ZinedineLegacy.setFilterType = function(node, type) {
	if(ZinedineLegacy.oldschool) {
		type = type.toUpperCase();
		node.type = node[type];
	} else {
		type = type.toLowerCase();
		node.type = type;
	}
}

ZinedineLegacy.setOscType = ZinedineLegacy.setFilterType;

// the real deal

Zinedine = {};

Zinedine.getContext = function() {
	if(typeof AudioContext != "undefined") {
		return AudioContext;
	} else if(typeof webkitAudioContext != "undefined") {
		return webkitAudioContext;
	} else {
		return undefined;
	}
}

Zinedine.defaultAudioFormat = function() {
	var ext = "mp3";
	var isChrome = navigator.userAgent.indexOf('Chrome') > -1;
	var isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
	
	if(isChrome || isFirefox) {
		ext = "ogg";
	}
	
	return ext;
}

Zinedine.monkeyPatch = function(ctx) {

	if(typeof(ctx.createGain) == "undefined") {
		ctx.createGain = function() {
			return ctx.createGainNode();
		}
	}
	
	if(typeof(ctx.createDelay) == "undefined") {
		ctx.createDelay = function(maxTime) {
			return ctx.createDelayNode(maxTime);
		}
	}
	
	// remove when ff has oscillators
	if(typeof(ctx.createOscillator) != "undefined") {
		var testOsc = ctx.createOscillator();
	
		if(typeof(testOsc.start) == "undefined") {
		
			ZinedineLegacy.oldschool = true;
			
			ctx.originalCO = ctx.createOscillator;
			ctx.createOscillator = function() {
				var osc = ctx.originalCO();
				osc.start = function(when) {
					return osc.noteOn(when);
				}
				osc.stop = function(when) {
					return osc.noteOff(when);
				}
				return osc;
			}
		}
	}
	
	var testBufferSrc = ctx.createBufferSource();
	
	if(typeof(testBufferSrc.start) == "undefined") {
		ctx.originalBS = ctx.createBufferSource;
		ctx.createBufferSource = function() {
			var bs = ctx.originalBS();
			bs.start = function(time, offset, duration) {
				if(time != undefined && offset != undefined && duration != undefined) {
					return bs.noteGrainOn(time, offset, duration);
				} else if(time != undefined && offset != undefined) {
					return bs.noteGrainOn(time, offset);
				} else if(time != undefined) {
					return bs.noteOn(time);
				} else {
					return bs.noteOn();
				}
			}
			bs.stop = function(when) {
				return bs.noteOff(when);
			}
			return bs;
		}
	}

	return ctx;
}

Zinedine.hasAPI = function() {
	var ctx = Zinedine.getContext();
	return (typeof(ctx) == "function") || (typeof(ctx) == "object");
}

Zinedine.ctx = undefined;
Zinedine.isInitialized = function() {
	return !(Zinedine.ctx === undefined);
}

Zinedine.init = function(forceAudio) {
	if(Zinedine.hasAPI()) {
		Zinedine.ctx = Zinedine.monkeyPatch(new (Zinedine.getContext())());
		Zinedine.ctx.listener.setPosition(0, 0, 0);
	};
	
	Zinedine.generated = Zinedine.initGenerated(); // provided by generated.js

    if(forceAudio) {
        Zinedine.forceAudio();
    }
}

// adds a silent oscillator to force audio to run
Zinedine.forceAudio = function() {
    var silent = Zinedine.ctx.createBufferSource();
    silent.buffer = Zinedine.generated.buffers.silent;
    var gain = Zinedine.ctx.createGain();
    gain.gain.value = 0;
    silent.connect(gain);
    gain.connect(Zinedine.ctx.destination);
    silent.start(0);
}

Zinedine.noAPIError = function() {
	alert("Sorry, Zinedine is not initialized or we couldn't find Web Audio API in your browser. Please use a recent version of Google Chrome or Safari >= 6");
}

// audio.js

AudioEffect = function() {
	var that = {}

	that.connect = function(node) {
		that.output.connect(Zinedine.helpers.getConnectionNode(node));
	};
	
	that.disconnect = function() {
		that.output.disconnect();
	};
	
	that.isSubpatch = true;

	return that;
};

ChannelStrip = function() {
	var that = AudioEffect();
	
	that.nodes = [];
	that.top = undefined
		
	that.addNode = function(name, node) {
		that.input.disconnect();
		that.input.connect(Zinedine.helpers.getConnectionNode(node));
		if(!that.top) {
			node.connect(that.prefaderOutput);
		} else {
			node.connect(Zinedine.helpers.getConnectionNode(that.top));
		};
		that.top = node;
		that.nodes[name] = node;
	};
	
	that.disconnectAll = function() {
		that.input.disconnect();
		that.output.disconnect();
		
		for(var i = 0; i < that.nodes.length; i++) {
			that.nodes[i].disconnect();
		};	
	};
		
	var gain = Zinedine.ctx.createGain();
	gain.gain.value = 1;
	that.output = gain;
	
	var in_gain = Zinedine.ctx.createGain();
	in_gain.gain.value = 1;
	that.input = in_gain;
	
	var prefader = Zinedine.ctx.createGain();
	prefader.gain.value = 1;
	that.prefaderOutput = prefader;
		
	in_gain.connect(prefader);
	prefader.connect(gain);
		
	that.nodes["out"] = gain;
	that.nodes["in"] = in_gain;
	that.nodes["prefaderOutput"] = prefader;
	
	return that;
};

Channel = function() {
	var that = ChannelStrip();
	
	that.event = function(e) {
		var ev = MusicEvent(e);
		ev.node = that.input;
		ev.channel = that.channel;
		return ev;
	};
	
	return that;
};

Bus = function() {
	var that = ChannelStrip();
	
	return that;
};

MainMixer = function() {

	if(!Zinedine.isInitialized()) {
		Zinedine.noAPIError();
		return undefined;
	};

	var that = {}
	that.master = ChannelStrip();
	that.master.connect(Zinedine.ctx.destination);
	
	that.channels = [];
	that.busses = [];
	that.sends = [];
	
	that.addChannel = function(name) {
		var channel = Channel();
		channel.connect(that.master.input);
		that.channels[name] = channel;
		return channel;
	};
	
	that.addBus = function(name, source, gain) {
		var bus = Bus();
		bus.connect(that.master.input);
		that.busses[name] = bus;
		
		if(source) {
			var send = that.addSend(name + "-send", source, bus.input, gain);
		};
		
		return bus;
	};
	
	that.addSend = function(name, from, to, gainValue) {
		gainValue = gainValue || 1;
		var send = Zinedine.ctx.createGain();
		from.connect(send);
		send.connect(to);
		that.sends[name] = send;
		send.gain.value = gainValue;
		return send;
	};
	
	that.disconnectAll = function() {
		that.master.disconnectAll();
		for(var i = 0; i < that.channels.length; i++) {
			that.channels[i].disconnectAll();
		};
		
		for(var i = 0; i < that.busses.length; i++) {
			that.busses[i].disconnectAll();
		};
		
		for(var i = 0; i < that.sends.length; i++) {
			that.sends[i].disconnect();
		};
	};
	
	return that;
};

// audio_gens.js

Gen = {};

Gen.OneshotSample = function(node, time, buffer, rate, offset, duration) {
	rate = rate || 1;
	
	var player = Zinedine.ctx.createBufferSource();
	player.buffer = buffer;
	player.playbackRate.value = rate;
	
	Zinedine.helpers.connectIfNode(player, node);
	
	if(duration !== undefined) {
		player.start(time, offset, duration);
	} else if(offset !== undefined) {
		player.start(time, offset);		
	} else {
		player.start(time);
	}

	return player;
};

Gen.OscillatorBurst = function(node, time, type, freq, duration, detune) {
	detune = detune || 0;
	
	if(type == "NOISE") {
		return Gen.WhiteNoiseBurst(node, time, duration);
	};
	
	var osc = Zinedine.ctx.createOscillator();
	ZinedineLegacy.setOscType(osc, type);
	Zinedine.helpers.setParam(osc.frequency, freq);
	Zinedine.helpers.setParam(osc.detune, detune);
	
	osc.start(time);
	osc.stop(time + duration);
	
	Zinedine.helpers.connectIfNode(osc, node);
	return osc;
};

Gen.OscillatorStackBurst = function(node, time, freq, types, detunes, amps, duration) {
	var postGain = Zinedine.ctx.createGain();
	postGain.gain.setValueAtTime(1, time);
	
	for(var i = 0; i < types.length; i++) {
		
		var oscGain = Zinedine.ctx.createGain();
		Zinedine.helpers.setParam(oscGain.gain, amps[i]);
		
		var osc = Gen.OscillatorBurst(oscGain, time, types[i], freq, duration, detunes[i]);
		
		oscGain.connect(postGain);
	};
	
	Zinedine.helpers.connectIfNode(postGain, node);
	return postGain;
};

Gen.WhiteNoiseBurst = function(node, time, duration) {
	
	var player = Zinedine.ctx.createBufferSource();
	player.buffer = Zinedine.generated.buffers.whiteNoise;
	player.loop = true;
	
	Zinedine.helpers.connectIfNode(player, node);
	
	var offset = Math.random() * Zinedine.generated.buffers.whiteNoise.duration;
	
	player.start(time, offset, duration);
	player.stop(time + duration);
		
	return player;
};

Gen.PercEnv = function(node, time, attack, decay, amp) {
	if(amp == undefined) { amp = 1;};
				
	var gain = Zinedine.ctx.createGain();
	gain.gain.value = 0;
	
	gain.gain.setValueAtTime(0, time);
	gain.gain.linearRampToValueAtTime(amp, time + attack);
	gain.gain.linearRampToValueAtTime(0, time + attack + decay);
	
	Zinedine.helpers.connectIfNode(gain, node);
	
	return gain;
};

Gen.EnvGain = function(node, env) {
	var gain = Zinedine.ctx.createGain();
	Zinedine.helpers.setParam(gain.gain, env);
	Zinedine.helpers.connectIfNode(gain, node);
	return gain;
};

Gen.SineEnv = function(node, time, len, amp) {
	if(amp == undefined) {amp = 1;};
	
	var gain = Zinedine.ctx.createGain();
	gain.gain.value = 1;
	gain.gain.setValueCurveAtTime(Zinedine.generated.arrays.sine, time, len);

	// alert(len);

	var postGain = Zinedine.ctx.createGain();
	postGain.gain.value = amp;
	
	gain.connect(postGain);
	
	Zinedine.helpers.connectIfNode(postGain, node);
	
	return gain;
};

Gen.FilterSweep = function(node, time, type, start, stop, duration, q) {
	q = q || 1;
	
	var filter = Zinedine.ctx.createBiquadFilter();
	
	ZinedineLegacy.setFilterType(filter, type);
	filter.Q.value = q;
	filter.frequency.value = start;
	filter.frequency.setValueAtTime(start, time);
	filter.frequency.linearRampToValueAtTime(stop, time + duration);
	
	Zinedine.helpers.connectIfNode(filter, node);
	
	return filter;
};

// christianSync.js

ChristianSyncAgent = function(clock, sendSyncFunction, finishSyncFunction, receiveSyncFunction, serverCompensation, numSyncs, timeFunction) {
	var that = {};

	numSyncs = numSyncs || 20;
	serverCompensation = serverCompensation || 0; // to implement

	receiveSyncFunction = receiveSyncFunction || function() {};
	finishSyncFunction = finishSyncFunction || function() {};

	timeFunction = timeFunction || function() {
		return new Date().getTime();
	}

	var sendNewSync = function() {
		sendSyncFunction({type: "sync", clientTime: timeFunction()}, that);
	}

	var commitSync = function() {
		clock.update();
		
		var serverTimeOnReceive = that.bestSync.serverTime + (that.bestSync.delta / 2);
		var serverTimeNow = serverTimeOnReceive + (timeFunction() - that.bestSync.receiveTime);
		var elapsedServerBeats = (serverTimeNow - that.bestSync.beatBase) / 1000 * clock.bps;

		clock.rebase(elapsedServerBeats);

		finishSyncFunction(that, elapsedServerBeats);
	}

	that.receiveSync = function(e) {
		that.syncsReceived = that.syncsReceived + 1;

		e.receiveTime = timeFunction();
		e.delta = e.receiveTime - e.clientTime;

		if(that.bestSync == undefined || e.delta < that.bestSync.delta) {
			that.bestSync = e;
		}

		if(that.syncsReceived < numSyncs) {
			receiveSyncFunction(that, e);
			sendNewSync();
		} else {
			commitSync();
		}
	}

	that.resendSync = function() {
		sendNewSync();
	}

	that.start = function() {
		that.bestSync = undefined;
		that.syncAccuracy = undefined;
		that.syncsReceived = 0;

		sendNewSync();
	}

	return that;
}

// effects.js

FX = {};

FX.PanPot = function(node, pan) {
	var that = AudioEffect();
	pan = pan || 0;
	
	var panner = Zinedine.ctx.createPanner();
	if(ZinedineLegacy.oldschool) {
		panner.panningModel = panner.EQUALPOWER;
	} else {
		panner.panningModel = "equalpower";
	}
			
	that.setPan = function(pan) {
		var x = Math.sin(0.5*Math.PI * pan);
		var z = -Math.cos(0.5*Math.PI * pan);
		panner.setPosition(x, 0, z);
	};
	
	that.setPan(pan);
	
	that.input = panner;
	that.output = panner;
	
	Zinedine.helpers.connectIfNode(panner, node);
	
	return that;
};

FX.FeedbackDelay = function(node, time, feedback) {
	var that = AudioEffect();

	var delay = Zinedine.ctx.createDelay(time * 2);
	delay.delayTime.value = time;
	var fbGain = Zinedine.ctx.createGain();
	fbGain.gain.value = feedback;
	
	delay.connect(fbGain);
	fbGain.connect(delay);
	
	that.feedback = fbGain.gain;
	that.delayTime = delay.delayTime;
	
	that.input = delay;
	that.output = delay;
	
	Zinedine.helpers.connectIfNode(delay, node);
		
	return that;
};

FX.Filter = function(node, type, freq, q) {
	var that = AudioEffect();
	
	q = q || 1;
	freq = freq || 350;
	
	var biquad = Zinedine.ctx.createBiquadFilter();
	ZinedineLegacy.setFilterType(biquad, type);
	
	that.freq = biquad.frequency;
	that.Q = biquad.Q;
	
	that.freq.value = freq;
	that.Q.value = q;
	
	that.input = biquad;
	that.output = biquad;
	
	Zinedine.helpers.connectIfNode(biquad, node);
	
	return that;
};

FX.Reverb = function(node, buffer) {

	var that = AudioEffect();
	var conv = Zinedine.ctx.createConvolver();
	conv.normalize = true;
	conv.buffer = buffer;
	
	that.input = conv;
	that.output = conv;
	Zinedine.helpers.connectIfNode(conv, node);
	
	return that;
};


FX.WaveShaper = function(node, preGain, postGain, array) {
	
	var that = AudioEffect();
	
	var preGainNode = Zinedine.ctx.createGain();
	preGainNode.gain.value = preGain;
	
	var postGainNode = Zinedine.ctx.createGain();
	postGainNode.gain.value = postGain;
	
	var shaper = Zinedine.ctx.createWaveShaper();
	shaper.curve = array;
	
	preGainNode.connect(shaper);
	shaper.connect(postGainNode);
	
	that.output = postGainNode;
	that.input = preGainNode;
	Zinedine.helpers.connectIfNode(that.output, node);
	
	that.preGain = preGainNode.gain;
	that.postGain = postGainNode.gain;
	
	return that;
}

FX.Compressor = function(node, threshold, knee, ratio, reduction, attack, release) {
	var that = AudioEffect();
	threshold = threshold || -12;
	knee = knee || 30;
	ratio = ratio || 12;
	attack = attack || 0.003;
	release = release || 2;
	
	var comp = Zinedine.ctx.createDynamicsCompressor();
	comp.threshold.value = threshold;
	comp.knee.value = knee;
	comp.ratio.value = ratio;
	comp.attack.value = attack;
	comp.release.value = release;
	
	that.output = comp;
	that.input = comp;
	Zinedine.helpers.connectIfNode(that.output, node);	
	
	return that;
};


// envelopes.js

/*
	First line in the Envs handles cases where an Event is inserted. This allows Env
	Functions to be scheduled in PatternAgents et all.
*/

var Env = {};

Env.BaseClass = function() {
	var that = {};
	that.isEnv = true;
	that.canApplyFunction = true;
		
	return that;
};

Env.DoBaseClass = function() {
	var that = {};
	that.isParamSetter = true;
	that.canApplyFunction = true;

	
	return that;
};

Env.Set = function(value) {
	if(Zinedine.helpers.getType(value) == "object") {return Env.Set(value.value).create(value).set(value.param);};
	
	var that = Env.BaseClass();
	
	that.applyFunction = function(func) {
		return Env.Set(func(value));
	};
	
	that.create = function(ev) {
		return Env.DoSet(value, ev.startTime);
	};
	
	return that;
};

Env.DoSet = function(value, startTime) {
	var that = Env.DoBaseClass();
	
	that.applyFunction = function(func) {
		return Env.DoSet(func(value), startTime);
	};
	
	that.set = function(param) {
		param.setValueAtTime(value, startTime);
	};
	
	that.length = undefined;
	
	return that;
};

// private basically
Env.NLine = function(startValue, stopValue, length, paramFunction) {
	var that = Env.BaseClass();
	
	that.applyFunction = function(func) {
		return Env.NLine(func(startValue), func(stopValue), length, paramFunction);
	};
	
	that.create = function(ev) {
		return Env.DoNLine(startValue, stopValue, ev.startTime, ev.startTime + length, paramFunction);
	};
	
	return that;
};

Env.Line = function(startValue, stopValue, length) {
	if(Zinedine.helpers.getType(startValue) == "object") {return Env.Line(startValue.startValue, startValue.stopValue, startValue.length).create(startValue).set(startValue.param);};
	return Env.NLine(startValue, stopValue, length, "linearRampToValueAtTime");
};
Env.XLine = function(startValue, stopValue, length) {
	if(Zinedine.helpers.getType(startValue) == "object") {return Env.XLine(startValue.startValue, startValue.stopValue, startValue.length).create(startValue).set(startValue.param);};
	return Env.NLine(startValue, stopValue, length, "exponentialRampToValueAtTime");
};


Env.DoNLine = function(startValue, stopValue, startTime, stopTime, paramFunction) {
	var that = Env.DoBaseClass();
	
	that.applyFunction = function(func) {
		return Env.DoNLine(func(startValue), func(stopValue), startTime, stopTime, paramFunction);
	};
	
	that.set = function(param) {
		param.setValueAtTime(startValue, startTime);
		param[paramFunction](stopValue, stopTime);
	};
	
	that.length = stopTime - startTime;
	
	that.toString = function() {
		return "Env.DoNLine: " + startValue + ", " + stopValue + ", " + startTime + ", " + stopTime;
	}
	
	return that;
};
Env.DoLine = function(startValue, stopValue, startTime, stopTime) {
	return Env.DoNLine(startValue, stopValue, startTime, stopTime, "linearRampToValueAtTime");
};
Env.DoXLine = function(startValue, stopValue, startTime, stopTime) {
	return Env.DoNLine(startValue, stopValue, startTime, stopTime, "exponentialRampToValueAtTime");
};

Env.Custom = function(values, times, types) {
	if(Zinedine.helpers.getType(values) == "object") {return Env.Custom(values.values, values.times, values.types).create(values).set(values.param);};

	var that = Env.BaseClass();
	
	that.applyFunction = function(func) {
		var list = [];
		for(var i = 0; i < values.length; i++) {
			list.push(func(values[i]));
		};
		return Env.Custom(list, times, types);
	};
	
	that.create = function(ev) {
		return Env.DoCustom(values, times, types, ev.startTime);
	};
	
	return that;
}

// mehr types durch buffer (?)
Env.DoCustom = function(values, times, types, startTime) {
	var that = Env.DoBaseClass();
	
	that.applyFunction = function(func) {
		var list = [];
		for(var i = 0; i < values.length; i++) {
			list.push(func(values[i]));
		};
		return Env.DoCustom(list, times, types, startTime);
	};
	
	that.set = function(param) {
		var currentTime = startTime;
		param.setValueAtTime(values[0], currentTime);
		
		for(var i = 0; i < values.length-1; i++) {
			currentTime = currentTime + times[i];
			if(types[i] == "exp") {
				param.exponentialRampToValueAtTime(values[i+1], currentTime);
			} else { // "lin" is default
				param.linearRampToValueAtTime(values[i+1], currentTime);
			};
		};
	};
	
	var length = 0;
	for(var i = 0; i < times.length; i++) {
		length = length + times[i];
	};
	that.length = length;
	
	return that;
};

// some SC basics

Env.Perc = function(attackTime, releaseTime, level, baseLevel) {
	if(Zinedine.helpers.getType(attackTime) == "object") {return Env.Perc(attackTime.attackTime,attackTime.releaseTime, attackTime.level, attackTime.baseLevel).create(attackTime).set(attackTime.param);};

	level = level || 1;
	baseLevel = baseLevel || 0;
	return Env.Custom([baseLevel, level, baseLevel], [attackTime, releaseTime], ["lin", "lin"]);
};

Env.Linen = function(attackTime, sustainTime, releaseTime, level, baseLevel) {
	if(Zinedine.helpers.getType(attackTime) == "object") {return Env.Linen(attackTime.attackTime, attackTime.sustainTime, attackTime.releaseTime, attackTime.level, attackTime.baseLevel).create(attackTime).set(attackTime.param);};

	level = level || 1;
	baseLevel = baseLevel || 0;
	return Env.Custom([baseLevel, level, level, baseLevel], [attackTime, sustainTime, releaseTime], ["lin", "lin", "lin"]);
};

Env.Triangle = function(length, level, baseLevel) {
	if(Zinedine.helpers.getType(length) == "object") {return Env.Custom(length.length, length.levels, length.baseLevel).create(length).set(length.param);};

	level = level || 1;
	baseLevel = baseLevel || 0;
	return Env.Custom([baseLevel, level, baseLevel], [length/2, length/2], ["lin", "lin"]);
};

// To implement: Buffer Env, vielleicht perc Env. Schauen ob man die alten Gens dann abschaffen sollte.
// Instrumenten ein env gain Node mitgebene? amp sollte einfach bleiben

// event_agents.js

EventAgent = function(quant, clock) {
	var that = {};
	
	quant = quant || 4;
	clock = clock || Zinedine.defaultQuantClock;
	
	that.quant = quant;
	that.clock = clock;
	that.finished = false;
	
	that.nextPollTime = clock.nextQuant(quant);
	
	that.update = function() {};
	that.emit = function() {return undefined};
	
	that.poll = function() {
		var beats = clock.currentBeats();
		
		if(beats < that.nextPollTime || that.finished) {
			return undefined;
		} else {
			return that.emit();
		};
	};
	
	return that;
};

MultiAgent = function(agents, quant, clock) {
	var that = EventAgent(quant, clock);
	
	that.nextPollTime = Infinity;
	that.agents = agents;

	var findNextPollTime = function() {
		for(var i = 0; i < that.agents.length; i++) {
			if(that.agents[i].nextPollTime < that.nextPollTime) {
				that.nextPollTime = that.agents[i].nextPollTime;
			};
		};
	};
	
	findNextPollTime();
	
	that.update = function() {
		for(var i = 0; i < that.agents.length; i++) {
			that.agents[i].update();
		};
		findNextPollTime();
	};
	
	that.poll = function() {
		for(var i = 0; i < that.agents.length; i++) {
			var value = that.agents[i].poll();
			if(value != undefined) {
				return value;
			};
		};
		findNextPollTime();
		return undefined;
	};
	
	return that;
};

NOPAgent = function(quant, clock) {
	var that = EventAgent(quant, clock);
	
	that.nextPollTime = Infinity;
	that.poll = function() {};
	
	return that;
}

AgentProxy = function(agent, quant, clock) {
	var that = EventAgent(quant, clock);
	
	if(!agent) {
		agent = NOPAgent();
	};
	
	that.agent = agent;
	that.nextAgent = undefined;
	
	that.poll = function() {
		return that.agent.poll()
	};
	
	that.update = function() {		
		if(that.nextAgent) {
			that.nextAgent.update();
			if(that.nextAgent.nextPollTime <= that.agent.nextPollTime) {
				that.agent = that.nextAgent;
				that.nextAgent = undefined;
				// document.writeln("Agent Handover");
			};
		};
		
		agent.update();
		that.nextPollTime = that.agent.nextPollTime;
	};
	
	that.replace = function(agent) {
		that.nextAgent = agent;
	};
	
	return that;
};

UpdatePatternAgent = function(patternEvent, quant, clock) {
	quant = patternEvent.quant || quant;	
	var that = EventAgent(quant, clock);

	var streamEvent = {};
	for(key in patternEvent) {
		streamEvent[key] = PatternStreamHelpers.buildStream(patternEvent[key]);
	};
	
	that.update = function() {	
		if(that.nextPollTime < that.clock.currentBeats()) {
			that.nextPollTime = that.clock.currentBeats();
		};
	
		var event = MusicEvent({clock: that.clock, start: that.nextPollTime});
		
		for(key in streamEvent) {
			event[key] = streamEvent[key].next(event);
		};
		
		if(event.action) {
			event.play();
		};
	};
	return that;
};

FuncAgent = function(func, quant, clock) {
	var that = EventAgent(quant, clock);
	
	that.emit = function() {
		var event = MusicEvent({clock: that.clock, start: that.nextPollTime});
		event = func(event);
		if(event) {
			that.nextPollTime = that.nextPollTime + event.dur;
			return event;
		} else {
			return undefined;
		};
	};
	
	return that;
};

PatternAgent = function(patternEvent, quant, clock) {
	quant = patternEvent.quant || quant;	
	var that = EventAgent(quant, clock);

	var streamEvent = {};
	for(key in patternEvent) {
		streamEvent[key] = Zinedine.patterns.helpers.buildStream(patternEvent[key]);
	};	
	
	that.emit = function() {
		var event;
		
		if(streamEvent.channel) {
			var channel = streamEvent.channel.next();
			event = channel.event({clock: that.clock, start:that.nextPollTime});
		} else {
			event = MusicEvent({clock: that.clock, start: that.nextPollTime});
		};
		
		for(key in streamEvent) {
			var val = streamEvent[key].next(event);
			if(val == undefined) {
				that.finished = true;
				return undefined;
			};
			event[key] = val;
		};
		
		that.nextPollTime = that.nextPollTime + event.dur;
		return event;
	};
	
	return that;
};

AgentManager = function() {
	var that = {};
	
	that.agents = [];
	
	that.addAgent = function(key, agent) {
		that.agents[key] = agent;
	};
	
	that.update = function() {
		for(key in that.agents) {
			var agent = that.agents[key];
			agent.update();
			while(true) {
				var event = agent.poll();
				if(event) {
					event.play();
				} else {
					break;
				};
			};
		};
	};
	
	return that;
};

Sched = {};

Sched.ReplacePattern = function(ev) {
	ev.proxy.replace(PatternAgent(ev.pattern, ev.quant));
};

Sched.ReplaceAgent = function(ev) {
	ev.proxy.replace(ev.agent);
};

Sched.MuteAgent = function(ev) {
	ev.proxy.replace(NOPAgent());
};

// generated.js

Zinedine.initGenerated = function() {
	that = {};
	
	that.buffers = {};
	that.arrays = {};
	
	var sr = 44100;
	that.sampleRate = 44100;
	
	var noiseSize = 44100 * 4;
	that.noiseSize = noiseSize;
	
	
	var lOscBaseFreq= noiseSize / 441;
	that.lOscBaseFreq = lOscBaseFreq;
	
	
	// White Noise Buffer
	that.buffers.whiteNoise = Zinedine.ctx.createBuffer(1, noiseSize, sr);
	var whiteNoise = that.buffers.whiteNoise.getChannelData(0);

	for(var i = 0; i < noiseSize; i++) {
		whiteNoise[i] = Math.random() * 2 - 1;
	};
	
	// LFSaw Buffer
	that.buffers.lfsaw = Zinedine.ctx.createBuffer(1, noiseSize, sr);
	var lfs = that.buffers.lfsaw.getChannelData(0);
	
	var delta = 1.0 / (noiseSize / 2 / lOscBaseFreq);
	var value = 0;
	for(var i = 0; i < noiseSize; i++) {
		value = value + delta;
		if(value > 1.0) {
			value = value - 2.0;
		};
		lfs[i] = value;
	};
	
	// LFTri Buffer, broken
	that.buffers.lftri = Zinedine.ctx.createBuffer(1, noiseSize, sr);
	var lft = that.buffers.lftri.getChannelData(0);
	
	var delta = 1.0 / (noiseSize / 4 / lOscBaseFreq);
	var value = 0;
	for(var i = 0; i < noiseSize; i++) {
		value = value + delta;
		if(Math.abs(value) > 1.0) {
			delta = delta * -1;
			/*
			if(value > 1) { value = value - (value - 1) };
			if(value < -1) { value = value - (value + 1) };
			*/
			if(value > 1) { value = 1; };
			if(value < -1) { value = -1; };
		};
		lft[i] = value;
	};
	
	// LFPulse Buffer, broken
	that.buffers.lfpulse = Zinedine.ctx.createBuffer(1, noiseSize, sr);
	var lfp = that.buffers.lfpulse.getChannelData(0);
	
	var value = 1.0;
	var smplsPerPhase = noiseSize / lOscBaseFreq / 2;
	var cntr = 0;
	for(var i = 0; i < noiseSize; i++) {
		lfp[i] = value;
		cntr = cntr + 1;
		if(cntr > smplsPerPhase) {
			cntr = 0;
			value = value * -1;
		};
	};
	
	// LFNoise Buffer
	that.buffers.lfnoise = Zinedine.ctx.createBuffer(1, noiseSize, sr);
	var lfn = that.buffers.lfnoise.getChannelData(0);
	
	var value = Math.random();
	var smplsPerPhase = noiseSize / lOscBaseFreq / 8;
	var cntr = 0;
	for(var i = 0; i < noiseSize; i++) {
		lfn[i] = value;
		cntr = cntr + 1;
		if(cntr >= smplsPerPhase) {
			cntr = 0;
			value = Math.random() * 2 - 1;
		};
	};
	
	// Silent
	that.buffers.silent = Zinedine.ctx.createBuffer(1, 4096, sr);
	var lfs = that.buffers.silent.getChannelData(0);
	
	// C paranoia
	for(var i = 0; i < 4096; i++) {
		lfs[i] = 0;
	}
	
	
	// Sine Envelope
	that.arrays.sine = new Float32Array(noiseSize);
	for(var i = 0; i < noiseSize; i++) {
		that.arrays.sine[i] = Math.sin(Math.PI * i / noiseSize);
	};
	
	// Tanh
	that.arrays.tanh = new Float32Array(noiseSize);
	for(var i = 0; i < noiseSize; i++) {
		var arg = (i / noiseSize) * 10 - 5;
		that.arrays.tanh[i] = (Math.exp(arg) - Math.exp(-arg)) / (Math.exp(arg) + Math.exp(-arg));
	};
	
	// Logistic Function
	// http://en.wikipedia.org/wiki/Logistic_function
	that.arrays.logistic = new Float32Array(noiseSize);
	for(var i = 0; i < noiseSize; i++) {
		var arg = (i / noiseSize) * 12 - 6;
		that.arrays.logistic[i] = 1 / (1 + Math.exp(-i));
	};
	
	return that;
};

// helpers.js

Zinedine.helpers = {};

// http://stackoverflow.com/questions/7390426/better-way-to-get-type-of-a-javascript-variable
Zinedine.helpers.getType = function() {
	var TYPES = {
		'undefined'        : 'undefined',
		'number'           : 'number',
		'boolean'          : 'boolean',
		'string'           : 'string',
		'[object Function]': 'function',
		'[object RegExp]'  : 'regexp',
		'[object Array]'   : 'array',
		'[object Date]'    : 'date',
		'[object Error]'   : 'error'
	};
	var TOSTRING = Object.prototype.toString;
	
	return function(o) {
		return TYPES[typeof o] || TYPES[TOSTRING.call(o)] || (o ? 'object' : 'null');
	};
}();

Zinedine.helpers.mixinObject = function(target, source) {
	for(var key in source) {
		target[key] = source[key];
	};
};

Zinedine.helpers.getConnectionNode = function(obj) {
	if(obj.isSubpatch) {
		return obj.input;
	} else {
		return obj;
	}
};

Zinedine.helpers.connectIfNode = function(player, node) {
	if(node) {
		node = Zinedine.helpers.getConnectionNode(node);
		player.connect(node);
	};
}

Zinedine.helpers.setParam = function(param, value) {
	if(value.isParamSetter) {
		value.set(param);
	} else {
		param.value = value;
	};
};

Zinedine.helpers.tryApplyFunction = function(func, value) {
	if(typeof(value) == "object" && value.canApplyFunction) {
		return value.applyFunction(func);
	} else {
		return func(value);
	};
};

// instruments.js

Instr = {};

Instrument = function(ev, defaults) {
	var that = AudioEffect();
	
	that.output = Zinedine.ctx.createGain();
	that.input = that.output;
	that.output.gain.value = ev.amp;
	
	if(ev.pan) {
		var pan = FX.PanPot(that.input, ev.pan);
		that.input = pan.input;
	};
	
	if(ev.node) {
		that.output.connect(ev.node);
	};
	
	if(defaults) {
		for(key in defaults) {
			if(ev[key] === undefined) {
				ev[key] = defaults[key];
			};
		};
	};
	
	if(ev.env != undefined) {
		if(ev.env.length != undefined) {
			ev.len = ev.env.length;
		};
	};
	
	return that;
};

// buffer, rate
Instr.Sample = function(ev) {
	var that = Instrument(ev, {rate: 1});
	Gen.OneshotSample(that, ev.startTime, ev.buffer, ev.rate);
	return that;
};

Instr.NoisePerc = function(ev) {
	var that = Instrument(ev, {attack: 0.0001, decay: 1});
	
	var env = Gen.PercEnv(that, ev.startTime, ev.attack, ev.decay);
	Gen.WhiteNoiseBurst(env, ev.startTime, ev.attack + ev.decay);
	
	return that;
};

Instr.WNHat = function(ev) {
	var that = Instrument(ev, {fltrStart: 12000, fltrStop: 5000, fltrLen: 0.05, fltrQ: 5});
	
	var env = Gen.PercEnv(that, ev.startTime, 0.00001, ev.len);
	var filter = Gen.FilterSweep(env, ev.startTime, "HIGHPASS", ev.fltrStart, ev.fltrStop, ev.fltrLen, ev.fltrQ);
	Gen.WhiteNoiseBurst(filter, ev.startTime, ev.len);
	
	return that;
};

Instr.Pling = function(ev) {
	var that = Instrument(ev, {attack: 0.0001, decay: 1});
	var env = Gen.PercEnv(that, ev.startTime, ev.attack, ev.decay);
	Gen.OscillatorBurst(env, ev.startTime, "SINE", ev.freq, ev.attack + ev.decay);

	return that;
};


Instr.OSCStackFilter = function(ev) {
	var that = Instrument(ev, {
		types: ["SAWTOOTH", "SQUARE", "SAWTOOTH"], detunes: [0,10, 14], amps: [0.5, 0.3, 0.2], 
		attack: 0.0001, decay: 0.2,
		filter: Env.XLine(100, 2000, 0.1).create(ev), filterQ: 10, filterType: "LOWPASS",
		env: Env.Perc(0.001, ev.len - 0.001).create(ev)
	});
	
	var fltr;
	if(ev.filter) { // skip, if filter is false
		fltr = FX.Filter(that, ev.filterType, 100, ev.filterQ);
		Zinedine.helpers.setParam(fltr.freq, ev.filter);
	} else {
		lfltrpf = that;
	};
	
	var env = Gen.EnvGain(fltr, ev.env);
	
	Gen.OscillatorStackBurst(env, ev.startTime, ev.freq, ev.types, ev.detunes, ev.amps, ev.attack + ev.decay);
	
	return that;
};
Instr.PercAcidBass = function(ev) {
	console.log("Deprecated: Instr.PercAcidBass");
	return Instr.OSCStackFilter(ev);
};

Instr.SineCluster = function(ev) {
	var that = Instrument(ev, {len:1, num:8, min:20, max:400});
		
	var env = Gen.SineEnv(that, ev.startTime, ev.len, 1/ev.num);
	
	for(var i = 0; i < ev.num; i++) {
		var pan = FX.PanPot(env, Math.random() * 2 - 1);
		var freq = ev.min + Math.random() * ev.max;
		Gen.OscillatorBurst(pan, ev.startTime, "SINE", freq, ev.len);
	};
	
	return that;
};

Instr.LFOscillator = function(ev) {
	var that = Instrument(ev, {
		env: Env.Perc(0.001, ev.len - 0.001).create(ev)
	})
		
	var envGain = Gen.EnvGain(that, ev.env);
	
	var player = Zinedine.ctx.createBufferSource();
	player.buffer = ev.buffer;
	player.loop = true;
	
	player.start(ev.startTime);
	player.stop(ev.startTime + ev.len);
		
	var rate = Zinedine.helpers.tryApplyFunction(function(freq) {
		return (freq / Zinedine.generated.lOscBaseFreq) * (Zinedine.generated.noiseSize / Zinedine.generated.sampleRate);
	}, ev.freq);
	
	
	Zinedine.helpers.setParam(player.playbackRate, rate);
	Zinedine.helpers.connectIfNode(player, envGain);
	
	return that;
};

// patterns.js

// if object, check if "isPattern", then "asStream"
// when polling, check if "isStream" then "next"

Zinedine.patterns = {};

// also a list
Zinedine.patterns.unpack = function(P) {
	P.const = Zinedine.patterns.Pconst;
	P.pull = Zinedine.patterns.Ppull;
	P.lace = Zinedine.patterns.Place;
	P.ser = Zinedine.patterns.Pser;
	P.add = Zinedine.patterns.Padd;
	P.sub = Zinedine.patterns.Psub;
	P.mul = Zinedine.patterns.Pmul;
	P.div = Zinedine.patterns.Pdiv;
	P.mod = Zinedine.patterns.Pmod;
	P.trace = Zinedine.patterns.Ptrace;
	P.white = Zinedine.patterns.Pwhite;
	P.func = Zinedine.patterns.Pfunc;
	P.sine = Zinedine.patterns.Psine;
	P.index = Zinedine.patterns.Pindex;
	P.key = Zinedine.patterns.Pkey;
	P.stutter = Zinedine.patterns.Pstutter;
	P.if = Zinedine.patterns.Pif;
	P.linlin = Zinedine.patterns.Plinlin;
	P.linexp = Zinedine.patterns.Plinexp;
	P.explin = Zinedine.patterns.Pexplin;
	P.expexp = Zinedine.patterns.Pexpexp;
	P.ltOr = Zinedine.patterns.PltOr;
	P.gtOr = Zinedine.patterns.PgtOr;
	P.eqOr = Zinedine.patterns.PeqOr;
	P.neqOr = Zinedine.patterns.PneqOr;

	return P;
};

Zinedine.patterns.helpers = function() {
	var that = {};
	
	that.buildStream = function(obj) {
		if(Zinedine.helpers.getType(obj) == "object" && obj.isPattern) {
			return obj.asStream();
		} else {
			return Zinedine.patterns.Pconst(obj).asStream();
		};
	};
	
	that.buildStreamArray = function(arr) {
		var ret = [];
		for(var i = 0; i < arr.length; i++) {
			ret.push(that.buildStream(arr[i]));
		};
		return ret;
	};

	return that;
}();

var Pattern = function() {
	var that = {};
	that.isPattern = true;
	
	that.first = function(ev) {
		ev = ev || MusicEvent();
		return that.asStream().next(ev);
	};
	
	that.firstN = function(n, ev) {
		ev = ev || MusicEvent();
		return that.asStream().nextN(n, ev);
	};
	
	that.trace = function(x) {return Zinedine.patterns.Ptrace(that, x);};
	that.floor = function() {return Zinedine.patterns.Pfunc(Math.floor, that);};
	that.ceil = function() {return Zinedine.patterns.Pfunc(Math.ceil, that);};
	that.add = function(x) {return Zinedine.patterns.Padd(that, x);};
	that.sub = function(x) {return Zinedine.patterns.Psub(that, x);};
	that.mul = function(x) {return Zinedine.patterns.Pmul(that, x);};
	that.div = function(x) {return Zinedine.patterns.Pdiv(that, x);};
	that.mod = function(x) {return Zinedine.patterns.Pmod(that, x);};
	that.linlin = function(inMin, inMax, outMin, outMax) { return Zinedine.patterns.Plinlin(that, inMin, inMax, outMin, outMax) };
	that.linexp = function(inMin, inMax, outMin, outMax) { return Zinedine.patterns.Plinexp(that, inMin, inMax, outMin, outMax) };
	that.explin = function(inMin, inMax, outMin, outMax) { return Zinedine.patterns.Pexplin(that, inMin, inMax, outMin, outMax) };
	that.expexp = function(inMin, inMax, outMin, outMax) { return Zinedine.patterns.Pexpexp(that, inMin, inMax, outMin, outMax) };
	that.ltOr = function(cmp, or) {return Zinedine.patterns.PltOr(that, cmp, or) };
	that.gtOr = function(cmp, or) {return Zinedine.patterns.PgtOr(that, cmp, or) };
	that.eqOr = function(cmp, or) {return Zinedine.patterns.PeqOr(that, cmp, or) };
	that.neqOr = function(cmp, or) {return Zinedine.patterns.PneqOr(that, cmp, or) };

	
	return that;
};

var PatternStream = function(pattern) {
	var that = {};
	that.isStream = true;
	
	that.nextN = function(n, ev) {
		var ret = [];
		for(var i = 0; i < n; i++) {
			ret.push(that.next(ev));
		};
		return ret;
	};
	
	that.reset = function() {
		return pattern.asStream()
	};
	
	return that;
};

Zinedine.patterns.Pconst = function(value) {
	var that = Pattern();	
	that.asStream = function() {
		var stream = PatternStream(that);
		stream.next = function(ev) {
			return value;
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.Ppull = function(table, key) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		stream.next = function(ev) {
			return table[key];
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.Place = function(sequence, times) {
	times = times || Infinity;
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		var seq = Zinedine.patterns.helpers.buildStreamArray(sequence);
		var i = -1;
		stream.next = function(ev) {
			i = i + 1;
			if(i < times * seq.length) {
				return seq[i%seq.length].next();
			} else {
				return undefined;
			};
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.Pser = function(start, stop, delta, times) {
	delta = delta || 1;
	times = times || Infinity;
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		var value = start;
		var timesLeft = times;
		stream.next = function(ev) {
			var ret = value;
			if(timesLeft > 0) {
				value = value + delta;
				if(delta > 0 && value > stop) {value = start; timesLeft = timesLeft - 1;};
				if(delta < 0 && value < stop) {value = start; timesLeft = timesLeft - 1;};
				if(timesLeft == 0) { value = stop;};
			};
			return ret;
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.PcmpOr = function(pattern, cmp, or, type) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		var inStream = Zinedine.patterns.helpers.buildStream(pattern);
		var cmpStream = Zinedine.patterns.helpers.buildStream(cmp);
		var orStream = Zinedine.patterns.helpers.buildStream(or);
		stream.next = function(ev) {
			var inValue = inStream.next(ev);
			var cmpValue = cmpStream.next(ev);
			switch(type) {
				case "lt":
					if(inValue >= cmpValue) { return orStream.next(ev);};
					break;
				case "gt":
					if(inValue <= cmpValue) { return orStream.next(ev);};
					break;
				case "eq":
					if(inValue != cmpValue) { return orStream.next(ev);};
					break;
				case "neq":
					if(inValue == cmpValue) { return orStream.next(ev);};
					break;
			};
			// no return yet?
			return inValue;
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.PltOr = function(pattern, cmp, or) {
	return Zinedine.patterns.PcmpOr(pattern, cmp, or, "lt");
};
Zinedine.patterns.PgtOr = function(pattern, cmp, or) {
	return Zinedine.patterns.PcmpOr(pattern, cmp, or, "gt");
};
Zinedine.patterns.PeqOr = function(pattern, cmp, or) {
	return Zinedine.patterns.PcmpOr(pattern, cmp, or, "eq");
};
Zinedine.patterns.PneqOr = function(pattern, cmp, or) {
	return Zinedine.patterns.PcmpOr(pattern, cmp, or, "neq");
};

Zinedine.patterns.PbinOp = function(pattern, x, op) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		var inStream = Zinedine.patterns.helpers.buildStream(pattern);
		var xStream = Zinedine.patterns.helpers.buildStream(x);
		stream.next = function(ev) {
			switch(op) {
				case "+":
					return inStream.next(ev) + xStream.next(ev);
				case "-":
					return inStream.next(ev) - xStream.next(ev);
				case "*":
					return inStream.next(ev) * xStream.next(ev);
				case "/":
					return inStream.next(ev) / xStream.next(ev);
				case "%":
					return inStream.next(ev) % xStream.next(ev);
				default:
					return undefined;
			};
		};
		return stream;
	};
	return that;	
};

Zinedine.patterns.Padd = function(pattern, add) {
	return Zinedine.patterns.PbinOp(pattern, add || 0, "+");
};
Zinedine.patterns.Psub = function(pattern, sub) {
	return Zinedine.patterns.PbinOp(pattern, sub || 0, "-");
};
Zinedine.patterns.Pmul = function(pattern, mul) {
	return Zinedine.patterns.PbinOp(pattern, mul || 1, "*");
};
Zinedine.patterns.Pdiv = function(pattern, div) {
	return Zinedine.patterns.PbinOp(pattern, div || 1, "/");
};
Zinedine.patterns.Pmod = function(pattern, mod) {
	return Zinedine.patterns.PbinOp(pattern, mod || 1, "%");
};

// process doesn't seem to work.
Zinedine.patterns.Pkey = function(key, process) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		stream.next = function(ev) {
			var myEvent;
			if(process) {
				myEvent = MusicEvent();
				for(key in ev) {
					myEvent[key] = ev[key];	
				};
				myEvent.process();
			} else {
				myEvent = ev;
			};
			return myEvent[key];
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.Pstutter = function(n, pattern) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream();
		var nStream = Zinedine.patterns.helpers.buildStream(n);
		var patternStream = Zinedine.patterns.helpers.buildStream(pattern);
		var counter = 0;
		var value = undefined;
		stream.next = function(ev) {
			if(counter <= 0) {
				counter = nStream.next(ev);
				value = patternStream.next(ev);
			};
			counter = counter - 1;
			return value;
		};
		return stream;
	};
	return that;
};


Zinedine.patterns.Pif = function(condition, trueCase, falseCase) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream();
		var conditionStream = Zinedine.patterns.helpers.buildStream(condition);
		var trueStream = Zinedine.patterns.helpers.buildStream(trueCase);
		var falseStream = Zinedine.patterns.helpers.buildStream(falseCase);
		stream.next = function(ev) {
			if(conditionStream.next(ev)) {
				return trueStream.next(ev);
			} else {
				return falseStream.next(ev);
			};			
		};
		return stream;
	};
	return that;
};


Zinedine.patterns.Ptrace = function(pattern, string) {
	string = string || "";
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		var inStream = Zinedine.patterns.helpers.buildStream(pattern);
		stream.next = function(ev) {
			var val = inStream.next(ev);
			console.log(string + val);
			return val;
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.Pwhite = function(min, max) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		stream.next = function(ev) {
			return min + (Math.random() * (max - min));
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.Pfunc = function(func, arg1, arg2, arg3) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		var arg1Stream, arg2Stream, arg3Stream;		
		if(arg1 != undefined) {arg1Stream = Zinedine.patterns.helpers.buildStream(arg1);};
		if(arg2 != undefined) {arg2Stream = Zinedine.patterns.helpers.buildStream(arg2);};
		if(arg3 != undefined) {arg3Stream = Zinedine.patterns.helpers.buildStream(arg3);};
		if(arg3 != undefined) {
			stream.next = function(ev) {
				return func(arg1Stream.next(ev), arg2Stream.next(ev), arg3Stream.next(ev));
			};
		} else if(arg2 != undefined) {
			stream.next = function(ev) {
				return func(arg1Stream.next(ev), arg2Stream.next(ev));
			};
		} else if(arg1 != undefined) {
			stream.next = function(ev) {
				return func(arg1Stream.next(ev));
			};
		} else {
			stream.next = function(ev) {
				return func(ev);
			};
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.Psine = function(freq, min, max, phase, clock) {
	min = min || -1;
	max = max || -1;
	phase = phase || 0;
	freq = freq || 4;
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		var startTime;
		stream.next = function(ev) {
			console.log(ev);
			var myClock = clock || ev.clock;
			if(!startTime) {
				startTime = myClock.currentBeats();
			};
			var curPhase = (myClock.currentBeats() - startTime) * 2.0 * Math.PI * freq + phase;
			return ((Math.sin(curPhase) + 1) * 0.5) * (max - min) + min;
		};
		return stream; 
	};
	return that;
};

Zinedine.patterns.Pindex = function(array, index) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		var indexStream = Zinedine.patterns.helpers.buildStream(index);
		stream.next = function(ev) {
			var i = indexStream.next(ev);
			if(i === undefined) { return undefined; };
			if(i < 0) { i = i * -1 };
			i = i % array.length;
			return array[i];
		};
		return stream;
	};
	return that;
};

Zinedine.patterns.Plinlin = function(pattern, inMin, inMax, outMin,  outMax) {
	return Zinedine.patterns.Prangerange(pattern, inMin, inMax, outMin, outMax, "linlin");
};
Zinedine.patterns.Plinexp = function(pattern, inMin, inMax, outMin,  outMax) {
	return Zinedine.patterns.Prangerange(pattern, inMin, inMax, outMin, outMax, "linexp");
};
Zinedine.patterns.Pexplin = function(pattern, inMin, inMax, outMin,  outMax) {
	return Zinedine.patterns.Prangerange(pattern, inMin, inMax, outMin, outMax, "explin");
};
Zinedine.patterns.Pexpexp = function(pattern, inMin, inMax, outMin,  outMax) {
	return Zinedine.patterns.Prangerange(pattern, inMin, inMax, outMin, outMax, "expexp");
};

Zinedine.patterns.Prangerange = function(pattern, inMin, inMax, outMin, outMax, type) {
	var that = Pattern();
	that.asStream = function() {
		var stream = PatternStream(that);
		var valueStream = Zinedine.patterns.helpers.buildStream(pattern);
		var inMinStream = Zinedine.patterns.helpers.buildStream(inMin);
		var inMaxStream = Zinedine.patterns.helpers.buildStream(inMax);
		var outMinStream = Zinedine.patterns.helpers.buildStream(outMin);
		var outMaxStream = Zinedine.patterns.helpers.buildStream(outMax);

		stream.next = function(ev) {
			var value = valueStream.next(ev);
			var inMin = inMinStream.next(ev);
			var inMax = inMaxStream.next(ev);
			var outMin = outMinStream.next(ev);
			var outMax = outMaxStream.next(ev);
			
			if(value < inMin) {return outMin};
			if(value > inMax) {return outMax};
			
			// see SuperCollider, SimpleNumber:linlin, etc.
			switch(type) {
				case "linlin":
					return (value - inMin) / (inMax - inMin) * (outMax - outMin) + outMin;
					break;
				case "linexp":
					return Math.pow(outMax / outMin, (value - inMin) / (inMax - inMin)) * outMin;
					break;
				case "explin":
					return (Math.log(value / inMin)) / (Math.log(inMax/inMin)) * (outMax-outMin) + outMin;
					break;
				case "expexp":
					return Math.pow(outMax/outMin, Math.log(value/inMin) / Math.log(inMax/inMin)) * outMin;
					break;
			};
			throw "Invalid type in Prangerange";
		};
		return stream;
	};
	return that;
};

// resourceLoader.js

Resource = function(key, path) {
	var that = {};
	that.payload = undefined;
	that.path = path;
	that.key = key;
	that.ready = false;
	that.state = "idle";
	that.error = undefined;
	
	that.free = function() {};
	
	return that;
}

// TODO: ResourceLoader should call start, if no resource is necessary.

ResourceLoader = function(base) {

	if(!Zinedine.isInitialized()) {
		Zinedine.noAPIError();
		return undefined;
	};

	var that = {};
	base = base || "";
	that.base = base;
	that.status = "ready";
	
	that.freeAll = function() {
		that.free(that.staticList);
		that.free(that.localList);
		
		that.staticList = [];
		that.localList = [];
		that.todoList = [];
		
		that.sfx = [];
		that.img = [];
	};
	
	that.free = function(list) {
		if(list != undefined) {
			for(var i = 0; i < list.length; i++) {
				list[i].free();
			}
		}
	};

	that.freeAll();
	
	that.load = function(where, dict, finishFunc, updateFunc, errorFunc) {
		var list;
		
		finishFunc = finishFunc || function() {}
		updateFunc = updateFunc || function(item, res) {}
		errorFunc = errorFunc || function(item, res) {}
		
		if(where == "static") {
			that.free(that.staticList);
			list = that.staticList;
			that.staticList = [];
		} else {
			that.free(that.localList);
			list = that.localList;
			that.localList = [];
		}
		
		var realUpdateFunc = function(res) {
			updateFunc(res, that);
			if(that.todoList.length == 0) {
				finishFunc();	
			}
		}

		var realErrorFunc = function(res) {
			if(res.error != undefined) {
				console.log(res.error);
			}
			errorFunc(res, that);
		}
				
		var sfxList = dict.sfx;
		if(sfxList) {
			for(var i = 0; i < sfxList.length; i++) {
				that.loadSFX(sfxList[i][0], base + sfxList[i][1], list, realUpdateFunc, realErrorFunc);
			}
		}

		var imgList = dict.img;
		if(imgList) {
			for(var i = 0; i < imgList.length; i++) {
				that.loadImg(imgList[i][0], base + imgList[i][1], list, realUpdateFunc, realErrorFunc);
			}
		}

		// nothing to load, let's go!
		if(that.todoList.length == 0) {
			finishFunc(that);
		}
	};
	
	var moveToList = function(object, list) {
		for(var i = 0; i < that.todoList.length; i++) {
			if(object === that.todoList[i]) {
				that.todoList.splice(i, 1);
				list.push(object);
				return;
			}
		}
	};

	that.loadImg = function(key, path, targetList, updateFunc, errorFunc) {
		var img = new Image();
		var result = Resource(key, path);

		that.todoList.push(result);
		
		img.onload = function() {
			result.payload = img;
			result.ready = true;
			result.state = "ready";
			moveToList(result, targetList);
			that.img[key] = result.payload;

			updateFunc(result);
		};

		img.onerror = function(e) {
			result.error = "Could not load image '" + result.path + "'";
			errorFunc(result);
		};

		try {
			img.src = path;
		} catch (e) {
			result.error = "Could not load image '" + result.path + "'";
			errorFunc(result);
		}
	};

	that.loadSFX = function(key, path, targetList, updateFunc, errorFunc) {
		var result = Resource(key, path);
		that.todoList.push(result);
		var xhr = new XMLHttpRequest();
		xhr.open('GET', path, true);
		xhr.responseType = 'arraybuffer';
		
		xhr.onerror = function(e) {
			console.log(e);
			errorFunc(result);
		};

		xhr.onload = function() {
		  result.state = "decoding"
		  updateFunc(result);

		  // besserer check!
		  if(xhr.status == 404 || xhr.status == 500) {
		  	result.error = "Could not load '" + result.path + "' -  Status: " + xhr.status;
		  	errorFunc(result);
		  	return;
		  }
		  
		  Zinedine.ctx.decodeAudioData(xhr.response, function(buffer) {
			result.payload = buffer;
			result.ready = true;
			result.state = "ready"
			moveToList(result, targetList);
			that.sfx[key] = result.payload;

			updateFunc(result);
		  }, function() {
		  	result.error = "Decoding '" + result.path + "' failed ...";
		  	errorFunc(result);
		  });
		};

		try {
			xhr.send();
		} catch(e) {
			result.error = "Could not send request";
			errorFunc(result);
		}
	};
	
	that.elementsToLoad = function() {
		return that.todoList.length;
	};
	
	return that;
};

// scheduling.js

QuantClock = function(tempo, latency, pauseOnBlur, setAsDefault) {
	if(pauseOnBlur === undefined) { pauseOnBlur = true; }
	tempo = tempo || 120;
	latency = latency || 0.2;

	var that = {};

	var beatsPerBar = 4;
	var pausedTime = 0;
	
	var clientCompensation = 0.035;
	
	that.isPaused = false;
	
	that.setTempo = function(tempo) {
		that.bpm = tempo;
		that.bps = tempo / 60;
	};
	that.setTempo(tempo);
	
	that.update = function(time) {
		if(!that.isPaused) {
			that.currentTime = time || (Zinedine.ctx.currentTime + latency);
			that.currentClientTime = that.currentTime - latency + clientCompensation;
			that.currentClientBeatTime = that.currentClientTime - pausedTime;
			that.currentClientBeat = that.currentClientBeatTime * that.bps;
		};
	};
	
	// TODO: should latency be part of the rebase process?	
	that.rebase = function(beats) {
		beats = beats || 0;
		that.startTime = Zinedine.ctx.currentTime - (beats / that.bps);
		that.update();
	}
	that.rebase(0); // start now

	that.relativeStartTime = function() {
		return that.startTime + pausedTime;
	}

	// 1 = beat, 0.25 = bar, 8 = eight ...
	that.nextDivision = function(div, beats) {
		div = div || 1;
		beats = beats || that.currentBeats();
		return Math.ceil(beats * div) / div;
	};
	
	that.nextDivisionTime = function(div, beats) {
		return that.audioTime(that.nextDivision(div, beats));
	};
	
	that.audioTime = function(beats) {
		return that.relativeStartTime() + (beats / that.bps);
	};
	
	that.audioClientBeatTime = function(beats) {
		// war mal nur that.startTime - kA ob das richtig ist so
		return that.relativeStartTime() + (beats / that.bps) - latency + clientCompensation;
	};
	
	that.absoluteAudioClientBeatTime = function(beats) {
		return that.startTime + (beats / that.bps) - latency + clientCompensation;
	};
		
	that.nextBar = function() {return that.nextDivision(1 / beatsPerBar)};
	that.nextBeat = function() {return that.nextDivision(1)};
	
	that.onBar = function(beats) {
		return (Math.floor(beats / beatsPerBar) * beatsPerBar) == beats;
	};
	
	that.onBeat = function(beats) {
		return Math.floor(beats) == beats;
	};
	
	that.onOffBeat = function(beats) {
		return beats - Math.floor(beats) == 0.5;
	};
	
	that.currentBeats = function() {
		return (that.currentTime - that.relativeStartTime()) * that.bps;
	};
	
	that.posInBar = function(beats, div) {
		var prevBar = Math.floor(beats / beatsPerBar) * beatsPerBar;
		var dif = beats - prevBar;
		if(!div) {
			return dif;
		} else {
			return Math.ceil(dif * div);
		};
	};
	
	that.nextQuant = function(quant, beats) {
		var q = Quant(quant);
		return that.nextDivision(1 / q.quant, beats) + q.phase + q.offset;
	};
	
	// Pausing
	var lastPause = 0;
	that.pause = function(e) {
		lastPause = Zinedine.ctx.currentTime;
		that.isPaused = true;
	};
	
	that.resume = function(e) {
		pausedTime = pausedTime + (Zinedine.ctx.currentTime - lastPause);
		that.isPaused = false;
	};
	
	if(pauseOnBlur) {
		window.addEventListener("blur", that.pause);
		window.addEventListener("focus", that.resume);
	}
	
	if(!Zinedine.defaultQuantClock || setAsDefault) {
		Zinedine.defaultQuantClock = that;
	}

	return that;
};

var Quant = function(quant, phase, offset) {
	if(quant.isQuant) {
		return quant;
	};
	
	phase = phase || 0;
	offset = offset || 0;
	
	return {
		quant: quant,
		phase: phase,
		offset: offset,
		isQuant: true
	};
};


var MusicEventHelpers = function() {
	var that = {};
	
	var scales = {
		"major": [0, 2, 4, 5, 7, 9, 11],
		"minor": [0, 2, 3, 5, 7, 8, 10],
		"minorPentatonic": [0, 3, 5, 7, 10],
		"majorPentatonic": [0, 2, 4, 7, 9],
		"blues": [0, 3, 5, 6, 7, 10]
	};
	
	
	// TODO: this is not really right, negative degrees?
	that.degree2midi = function(e) {
		var func = function(degree) {
			var scale = scales[e.scale];
			var midi = (12 * e.octave) + e.root + scale[degree % scale.length];
			if(degree >= scale.length) {
				midi = midi + (Math.floor(degree / scale.length) * 12);
			} else if(degree < 0) {
				midi = midi - (Math.floor(degree / scale.length) * 12);
			};
			return midi;
		};
		e.midi = Zinedine.helpers.tryApplyFunction(func, e.degree);
	};
	
	that.midi2freq = function(e) {
		var func = function(midi) {
			return Math.pow(2, (midi - 69) / 12) * e.standard_pitch;
		};
		
		e.freq = Zinedine.helpers.tryApplyFunction(func, e.midi);
	};
	
	that.processKeys = function(e) {
		
		if(e.action == undefined && e.buffer != undefined) {
			e.action = Instr.Sample;
		};
		
		if(e.dur != undefined && e.len == undefined) {
			e.len = (e.dur * e.sustain) / e.clock.bps;
		};
		
		if(e.midi == undefined) {
			that.degree2midi(e);
		};
		if(e.freq == undefined && e.midi != undefined) {
			that.midi2freq(e);
		};
				
		if(e.start == undefined) {
			e.start = e.clock.currentBeats();
		};
		
		e.start = e.start + e.offset;
		
		if(e.startTime == undefined) {
			e.startTime =  e.clock.audioTime(e.start);
		};		
	};
	
	return that;
}();

MusicEvent = function() {
	var proto = {
		root: 0,
		scale: "minor",
		octave: 3,
		standard_pitch: 440,
		degree: 0,
		amp: 1,
		sustain: 1,
		dur: 1,
		offset: 0
	};
	
	return function(ev) {
		var that = Object.beget(proto);
		
		if(ev) {
			Zinedine.helpers.mixinObject(that, ev);
		};
		
		// add timing
		that.clock = Zinedine.defaultQuantClock;
		
		that.process = function() {
			MusicEventHelpers.processKeys(that);
			return that;
		};
		
		that.play = function(quant) {
			if(ev.quant) {
				quant = ev.quant;
			};
			
			
			if(quant) {
				that.start = that.clock.nextQuant(quant, that.start);
			};
			
			if(!that.node && that.channel) {
				that.node = that.channel.input;
			};
			
			that.process();
			
			// build paramSet objects from envelopes
			for(key in that) {
				if(typeof(that[key]) == "object") {
					if(that[key].isEnv) {
						that[key] = that[key].create(that);
					};
				};
			};
			
			if(that.rest != true) {
				that.action(that);
			};
		};
		
		return that;
	};
}();

