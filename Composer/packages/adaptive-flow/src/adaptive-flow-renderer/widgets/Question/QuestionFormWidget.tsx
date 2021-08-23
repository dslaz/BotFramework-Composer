// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useEffect, useRef } from 'react';
import { WidgetContainerProps, useShellApi } from '@bfc/extension-client';
import { Dropdown, IDropdownOption } from 'office-ui-fabric-react/lib/Dropdown';
import { NeutralColors } from '@uifabric/fluent-theme';
import { FontSizes } from 'office-ui-fabric-react/lib/Styling';
import { TextField } from 'office-ui-fabric-react/lib/TextField';
import debounce from 'lodash/debounce';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { nanoid } from 'nanoid';

import { QuestionOptions } from './QuestionOptions';

interface QuestionFormWidgetProps extends WidgetContainerProps {
  prompt: React.ReactNode;
}

const typeOptions: IDropdownOption[] = [
  {
    key: 'choice',
    text: 'Multiple choice options',
    data: {
      description: 'Prebuilt, String',
    },
  },
  {
    key: 'text',
    text: "User's entire response",
    data: {
      description: 'No entity extraction; saved as is',
    },
  },
  {
    key: 'number',
    text: 'Number',
    data: {
      description: 'Prebuilt,Cardinal numbers in numeric or text form, extracted as a number',
    },
  },
  {
    key: 'confirm',
    text: 'User confirmation',
    data: {
      description: 'Prebuilt, User confirmation, extracted as a boolean',
    },
  },
];

const typeToType = {
  choice: 'string',
  text: 'string',
  number: 'number',
  confirm: 'boolean',
};

const renderTypeOption = (props) => {
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{}}>{props.text}</div>
      <div style={{ color: NeutralColors.gray100, fontSize: FontSizes.small }}>{props.data?.description}</div>
    </div>
  );
};

const QuestionFormWidget = ({ prompt, data, id }: QuestionFormWidgetProps) => {
  const { shellApi } = useShellApi();
  const [localData, setLocalData] = useState(data);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const syncData = useRef(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debounce((data: any, id: string) => {
      shellApi.saveData(data, id);
    }, 300)
  ).current;

  useEffect(() => {
    syncData(localData, id);

    return () => {
      syncData.cancel();
    };
  }, [localData]);

  const clickHandler = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTypeChange = (e, option) => {
    if (option?.key && localData.type !== option.key) {
      const type = option.key;
      // remove cases?
      // handle confirm cases
      let choices: any = undefined;
      let cases: any = undefined;

      if (type !== 'choice') {
        choices = undefined;
        cases = undefined;
      }

      if (type === 'confirm') {
        cases = [
          {
            value: true,
            actions: [],
          },
          {
            value: false,
            actions: [],
          },
        ];
      }

      setLocalData({ ...localData, type, choices, cases });
    }
  };

  const handlePropertyChange = (e, newValue) => {
    setLocalData({ ...localData, property: newValue });
    setErrors((current) => ({
      ...current,
      property: newValue ? undefined : 'Variable name required',
    }));
  };

  const onAddChoice = () => {
    const id = nanoid(6);
    const newChoice = { value: '', id };
    const choices = (localData.choices || []).concat(newChoice);

    const newCase = { value: '', actions: [], choiceId: id };
    const cases = (localData.cases || []).concat(newCase);

    setLocalData({ ...localData, choices, cases });
  };

  const onEditChoice = (id: string, value: string) => {
    const choices = (localData.choices || []).map((choice) => {
      if (choice.id === id) {
        return { ...choice, value };
      }

      return choice;
    });

    const cases = (localData.cases || []).map((c) => {
      if (c.choiceId === id) {
        return { ...c, value };
      }

      return c;
    });

    setLocalData({ ...localData, choices, cases });
  };

  const onRemoveChoice = (id: string) => {
    const choices = (localData.choices ?? []).filter((choice) => choice.id !== id);
    const cases = (localData.cases ?? []).filter((c) => c.choiceId !== id);

    setLocalData({ ...localData, choices, cases });
  };

  return (
    <React.Fragment>
      <Label>Question</Label>
      {prompt}
      <Dropdown
        label="Identify"
        options={typeOptions}
        selectedKey={localData.type}
        styles={{
          label: { margin: '5px 0' },
          dropdownItem: { height: 'auto' },
          dropdownItemSelected: { height: 'auto' },
        }}
        onChange={handleTypeChange}
        onRenderOption={renderTypeOption}
      />
      {localData.type === 'choice' && (
        <QuestionOptions
          options={localData.choices || []}
          onAdd={onAddChoice}
          onChange={onEditChoice}
          onRemove={onRemoveChoice}
        />
      )}
      <TextField
        errorMessage={errors.property}
        label="Save response as"
        prefix="{x}"
        styles={{ root: { marginTop: '5px' }, fieldGroup: { marginTop: '5px' } }}
        suffix={typeToType[localData.type]}
        value={localData.property}
        onChange={handlePropertyChange}
        onClick={clickHandler}
      />
    </React.Fragment>
  );
};

export { QuestionFormWidget };