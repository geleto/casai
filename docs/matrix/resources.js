// Generated from canonical .cat/.cas files. Run npm run docs:matrix after editing them.
export default {
  "Decision.cas": "return \"Customer request: \" ~ issue ~ \"\\n\" ~ lookupInfo()\n",
  "Decision.cat": "Customer request: {{ issue }}\n{{ lookupInfo() }}\n",
  "Embedder.cas": "var features = lookupInfo()\nvar description = title ~ '. ' ~ features\nif batch\n  return [description, 'Trail bottle. ' ~ features]\nendif\nreturn description\n",
  "Embedder.cat": "{{ title }}. {{ lookupInfo() }}\n",
  "ImageGenerator.cas": "return 'Place a Trail mug on ' ~ scene ~ '. ' ~ lookupInfo()\n",
  "ImageGenerator.cat": "Place a Trail mug on {{ scene }}. {{ lookupInfo() }}\n",
  "LLMAgent.cas": "return \"Policy: \" ~ policy ~ \"\\nQuestion: \" ~ question\n",
  "LLMAgent.cat": "Policy: {{ policy }}\nQuestion: {{ question }}\n",
  "Reranker.cas": "return question ~ \" \" ~ lookupInfo()\n",
  "Reranker.cat": "{{ question }} {{ lookupInfo() }}\n",
  "Script.cas": "var order = getOrder(orderId)\nvar shipment = getShipment()\nreturn { orderId: orderId, total: order.subtotal + shipment.cost, deliveryDay: shipment.deliveryDay }\n",
  "SpeechGenerator.cas": "return 'Hello ' + name + '. Your Northstar order is due ' + deliveryDay() + '.'\n",
  "SpeechGenerator.cat": "Hello {{ name }}. Your Northstar order is due {{ deliveryDay() }}.\n",
  "Template.cat": "{{ company }} delivery update\nHello {{ name }}, order {{ orderId }} is due {{ deliveryDay() }}.\nTrack it using the link in your order confirmation.\n",
  "Transcriber.cas": "return getRecording(findRecording())\n",
  "Translator.cas": "return recordings[findRecording()]()\n",
  "VoiceSessionSetup.cas": "return 'Help ' + company + ' customers in ' + language + '. Keep replies short and ask one question at a time.'\n",
  "VoiceSessionSetup.cat": "Help {{ company }} customers in {{ language }}. Keep replies short and ask one question at a time.\n"
};
