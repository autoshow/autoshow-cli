import warnings
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['PYTHONWARNINGS'] = 'ignore'

try:
    from TTS.api import TTS
    tts = TTS()
    model_manager = tts.list_models()
    
    models = []
    if hasattr(model_manager, 'list_models'):
        models = model_manager.list_models()
    elif hasattr(model_manager, 'models'):
        models = list(model_manager.models.keys())
    elif hasattr(model_manager, '__iter__'):
        models = list(model_manager)
    else:
        for attr in ['tts_models', 'models_dict', 'model_list']:
            if hasattr(model_manager, attr):
                attr_value = getattr(model_manager, attr)
                if isinstance(attr_value, dict):
                    models = list(attr_value.keys())
                elif isinstance(attr_value, list):
                    models = attr_value
                break
    
    if not models:
        from TTS.utils.manage import ModelManager
        if hasattr(ModelManager, 'list_models'):
            mm = ModelManager()
            models = mm.list_models()
    
    print(f"MODELS_START:{len(models)}")
    for model in models:
        print(model)
    print("MODELS_END")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()